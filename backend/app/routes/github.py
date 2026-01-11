"""GitHub OAuth and sync endpoints"""
import os
import json
import base64
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
import httpx

from .. import models, auth
from ..database import get_db

router = APIRouter(prefix="/github", tags=["github"])

# GitHub OAuth config
GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID", "")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET", "")
GITHUB_REDIRECT_URI = os.getenv("GITHUB_REDIRECT_URI", "http://localhost:3000/settings/integrations/callback")


# Request/Response schemas
class GitHubConnectionResponse(BaseModel):
    id: int
    github_username: str
    connected_at: datetime

    class Config:
        from_attributes = True


class GitHubRepo(BaseModel):
    id: int
    name: str
    full_name: str
    private: bool
    default_branch: str
    html_url: str


class TrackGitSyncResponse(BaseModel):
    id: int
    track_id: int
    repo_owner: str
    repo_name: str
    branch: str
    last_sync_at: Optional[datetime]
    last_sync_sha: Optional[str]

    class Config:
        from_attributes = True


class SetupSyncRequest(BaseModel):
    repo_owner: str
    repo_name: str
    branch: str = "main"


class TrackExport(BaseModel):
    """Track data for export/import"""
    title: str
    slug: str
    description: Optional[str]
    docker_image: str
    tags: list[str]
    difficulty: str
    estimated_minutes: Optional[int]
    env_template: list[dict]
    steps: list[dict]


# OAuth endpoints
@router.get("/auth/url")
def get_github_auth_url(
    current_user: models.User = Depends(auth.get_current_user)
):
    """Get GitHub OAuth authorization URL"""
    if not GITHUB_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="GitHub integration not configured"
        )

    # Scopes needed: repo (for private repos), user (for user info)
    scope = "repo,user"
    auth_url = (
        f"https://github.com/login/oauth/authorize"
        f"?client_id={GITHUB_CLIENT_ID}"
        f"&redirect_uri={GITHUB_REDIRECT_URI}"
        f"&scope={scope}"
        f"&state={current_user.id}"  # Use user ID as state for verification
    )

    return {"auth_url": auth_url}


@router.post("/auth/callback")
async def github_oauth_callback(
    code: str,
    state: str,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """Handle GitHub OAuth callback - exchange code for token"""
    if not GITHUB_CLIENT_ID or not GITHUB_CLIENT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="GitHub integration not configured"
        )

    # Verify state matches user
    if state != str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid OAuth state"
        )

    # Exchange code for access token
    async with httpx.AsyncClient() as client:
        token_response = await client.post(
            "https://github.com/login/oauth/access_token",
            data={
                "client_id": GITHUB_CLIENT_ID,
                "client_secret": GITHUB_CLIENT_SECRET,
                "code": code,
                "redirect_uri": GITHUB_REDIRECT_URI,
            },
            headers={"Accept": "application/json"}
        )

        if token_response.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to exchange code for token"
            )

        token_data = token_response.json()

        if "error" in token_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=token_data.get("error_description", "OAuth failed")
            )

        access_token = token_data["access_token"]
        scope = token_data.get("scope", "")

        # Get user info from GitHub
        user_response = await client.get(
            "https://api.github.com/user",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/vnd.github.v3+json"
            }
        )

        if user_response.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to get GitHub user info"
            )

        github_user = user_response.json()

    # Check if connection already exists
    existing = db.query(models.GitHubConnection).filter(
        models.GitHubConnection.user_id == current_user.id
    ).first()

    if existing:
        # Update existing connection
        existing.github_user_id = github_user["id"]
        existing.github_username = github_user["login"]
        existing.access_token = access_token
        existing.scope = scope
        existing.connected_at = datetime.utcnow()
    else:
        # Create new connection
        connection = models.GitHubConnection(
            user_id=current_user.id,
            github_user_id=github_user["id"],
            github_username=github_user["login"],
            access_token=access_token,
            scope=scope
        )
        db.add(connection)

    db.commit()

    return {"message": "GitHub connected successfully", "username": github_user["login"]}


@router.get("/connection", response_model=Optional[GitHubConnectionResponse])
def get_github_connection(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """Get current user's GitHub connection status"""
    connection = db.query(models.GitHubConnection).filter(
        models.GitHubConnection.user_id == current_user.id
    ).first()

    return connection


@router.delete("/connection")
def disconnect_github(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """Disconnect GitHub account"""
    connection = db.query(models.GitHubConnection).filter(
        models.GitHubConnection.user_id == current_user.id
    ).first()

    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No GitHub connection found"
        )

    db.delete(connection)
    db.commit()

    return {"message": "GitHub disconnected"}


@router.get("/repos", response_model=list[GitHubRepo])
async def list_repos(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """List GitHub repositories for the connected user"""
    connection = db.query(models.GitHubConnection).filter(
        models.GitHubConnection.user_id == current_user.id
    ).first()

    if not connection:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="GitHub not connected"
        )

    async with httpx.AsyncClient() as client:
        response = await client.get(
            "https://api.github.com/user/repos",
            headers={
                "Authorization": f"Bearer {connection.access_token}",
                "Accept": "application/vnd.github.v3+json"
            },
            params={
                "sort": "updated",
                "per_page": 100
            }
        )

        if response.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to fetch repositories"
            )

        repos = response.json()

    return [
        GitHubRepo(
            id=repo["id"],
            name=repo["name"],
            full_name=repo["full_name"],
            private=repo["private"],
            default_branch=repo["default_branch"],
            html_url=repo["html_url"]
        )
        for repo in repos
    ]


# Track export/import
@router.get("/tracks/{slug}/export", response_model=TrackExport)
def export_track(
    slug: str,
    current_user: models.User = Depends(auth.get_current_author),
    db: Session = Depends(get_db)
):
    """Export a track as JSON"""
    track = db.query(models.Track).filter(
        models.Track.slug == slug,
        models.Track.author_id == current_user.id
    ).first()

    if not track:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Track not found"
        )

    return TrackExport(
        title=track.title,
        slug=track.slug,
        description=track.description,
        docker_image=track.docker_image,
        tags=track.tags or [],
        difficulty=track.difficulty or "beginner",
        estimated_minutes=track.estimated_minutes,
        env_template=track.env_template or [],
        steps=[
            {
                "order": step.order,
                "title": step.title,
                "instructions_md": step.instructions_md,
                "setup_script": step.setup_script,
                "validation_script": step.validation_script,
                "hints": step.hints or []
            }
            for step in sorted(track.steps, key=lambda s: s.order)
        ]
    )


@router.post("/tracks/import")
def import_track(
    data: TrackExport,
    current_user: models.User = Depends(auth.get_current_author),
    db: Session = Depends(get_db)
):
    """Import a track from JSON"""
    # Check if slug already exists for this user
    existing = db.query(models.Track).filter(
        models.Track.slug == data.slug,
        models.Track.org_id == current_user.org_id
    ).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Track with slug '{data.slug}' already exists"
        )

    # Create track
    track = models.Track(
        title=data.title,
        slug=data.slug,
        description=data.description,
        docker_image=data.docker_image,
        tags=data.tags,
        difficulty=data.difficulty,
        estimated_minutes=data.estimated_minutes,
        env_template=data.env_template,
        author_id=current_user.id,
        org_id=current_user.org_id,
        is_published=False
    )
    db.add(track)
    db.flush()

    # Create steps
    for step_data in data.steps:
        step = models.Step(
            track_id=track.id,
            order=step_data["order"],
            title=step_data["title"],
            instructions_md=step_data.get("instructions_md", ""),
            setup_script=step_data.get("setup_script", ""),
            validation_script=step_data.get("validation_script", ""),
            hints=step_data.get("hints", [])
        )
        db.add(step)

    db.commit()
    db.refresh(track)

    return {"message": "Track imported successfully", "track_id": track.id, "slug": track.slug}


# Git sync endpoints
@router.get("/tracks/{slug}/sync", response_model=Optional[TrackGitSyncResponse])
def get_track_sync(
    slug: str,
    current_user: models.User = Depends(auth.get_current_author),
    db: Session = Depends(get_db)
):
    """Get sync status for a track"""
    track = db.query(models.Track).filter(
        models.Track.slug == slug,
        models.Track.author_id == current_user.id
    ).first()

    if not track:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Track not found"
        )

    sync = db.query(models.TrackGitSync).filter(
        models.TrackGitSync.track_id == track.id
    ).first()

    return sync


@router.post("/tracks/{slug}/sync/setup", response_model=TrackGitSyncResponse)
def setup_track_sync(
    slug: str,
    data: SetupSyncRequest,
    current_user: models.User = Depends(auth.get_current_author),
    db: Session = Depends(get_db)
):
    """Setup GitHub sync for a track"""
    track = db.query(models.Track).filter(
        models.Track.slug == slug,
        models.Track.author_id == current_user.id
    ).first()

    if not track:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Track not found"
        )

    # Check if sync already exists
    existing = db.query(models.TrackGitSync).filter(
        models.TrackGitSync.track_id == track.id
    ).first()

    if existing:
        # Update existing
        existing.repo_owner = data.repo_owner
        existing.repo_name = data.repo_name
        existing.branch = data.branch
        db.commit()
        db.refresh(existing)
        return existing

    # Create new sync
    sync = models.TrackGitSync(
        track_id=track.id,
        repo_owner=data.repo_owner,
        repo_name=data.repo_name,
        branch=data.branch
    )
    db.add(sync)
    db.commit()
    db.refresh(sync)

    return sync


@router.post("/tracks/{slug}/sync/push")
async def push_track_to_github(
    slug: str,
    current_user: models.User = Depends(auth.get_current_author),
    db: Session = Depends(get_db)
):
    """Push track content to GitHub repository"""
    # Get track
    track = db.query(models.Track).filter(
        models.Track.slug == slug,
        models.Track.author_id == current_user.id
    ).first()

    if not track:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Track not found"
        )

    # Get sync config
    sync = db.query(models.TrackGitSync).filter(
        models.TrackGitSync.track_id == track.id
    ).first()

    if not sync:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Track sync not configured"
        )

    # Get GitHub connection
    connection = db.query(models.GitHubConnection).filter(
        models.GitHubConnection.user_id == current_user.id
    ).first()

    if not connection:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="GitHub not connected"
        )

    # Export track data
    export_data = TrackExport(
        title=track.title,
        slug=track.slug,
        description=track.description,
        docker_image=track.docker_image,
        tags=track.tags or [],
        difficulty=track.difficulty or "beginner",
        estimated_minutes=track.estimated_minutes,
        env_template=track.env_template or [],
        steps=[
            {
                "order": step.order,
                "title": step.title,
                "instructions_md": step.instructions_md,
                "setup_script": step.setup_script,
                "validation_script": step.validation_script,
                "hints": step.hints or []
            }
            for step in sorted(track.steps, key=lambda s: s.order)
        ]
    )

    # Prepare file content
    track_json = json.dumps(export_data.model_dump(), indent=2)
    content_b64 = base64.b64encode(track_json.encode()).decode()

    async with httpx.AsyncClient() as client:
        # Check if file exists (to get SHA for update)
        file_path = f"livelabs/{track.slug}/track.json"
        get_response = await client.get(
            f"https://api.github.com/repos/{sync.repo_owner}/{sync.repo_name}/contents/{file_path}",
            headers={
                "Authorization": f"Bearer {connection.access_token}",
                "Accept": "application/vnd.github.v3+json"
            },
            params={"ref": sync.branch}
        )

        sha = None
        if get_response.status_code == 200:
            sha = get_response.json().get("sha")

        # Create/update file
        put_data = {
            "message": f"Update track: {track.title}",
            "content": content_b64,
            "branch": sync.branch
        }
        if sha:
            put_data["sha"] = sha

        put_response = await client.put(
            f"https://api.github.com/repos/{sync.repo_owner}/{sync.repo_name}/contents/{file_path}",
            headers={
                "Authorization": f"Bearer {connection.access_token}",
                "Accept": "application/vnd.github.v3+json"
            },
            json=put_data
        )

        if put_response.status_code not in [200, 201]:
            error = put_response.json()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to push to GitHub: {error.get('message', 'Unknown error')}"
            )

        result = put_response.json()
        commit_sha = result.get("commit", {}).get("sha")

    # Update sync status
    sync.last_sync_at = datetime.utcnow()
    sync.last_sync_sha = commit_sha
    db.commit()

    return {
        "message": "Track pushed to GitHub",
        "commit_sha": commit_sha,
        "file_path": file_path
    }


@router.post("/tracks/{slug}/sync/pull")
async def pull_track_from_github(
    slug: str,
    current_user: models.User = Depends(auth.get_current_author),
    db: Session = Depends(get_db)
):
    """Pull track content from GitHub repository"""
    # Get track
    track = db.query(models.Track).filter(
        models.Track.slug == slug,
        models.Track.author_id == current_user.id
    ).first()

    if not track:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Track not found"
        )

    # Get sync config
    sync = db.query(models.TrackGitSync).filter(
        models.TrackGitSync.track_id == track.id
    ).first()

    if not sync:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Track sync not configured"
        )

    # Get GitHub connection
    connection = db.query(models.GitHubConnection).filter(
        models.GitHubConnection.user_id == current_user.id
    ).first()

    if not connection:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="GitHub not connected"
        )

    file_path = f"livelabs/{track.slug}/track.json"

    async with httpx.AsyncClient() as client:
        # Get file content
        get_response = await client.get(
            f"https://api.github.com/repos/{sync.repo_owner}/{sync.repo_name}/contents/{file_path}",
            headers={
                "Authorization": f"Bearer {connection.access_token}",
                "Accept": "application/vnd.github.v3+json"
            },
            params={"ref": sync.branch}
        )

        if get_response.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Track file not found in repository"
            )

        file_data = get_response.json()
        content_b64 = file_data.get("content", "")
        sha = file_data.get("sha")

        # Decode and parse JSON
        content = base64.b64decode(content_b64).decode()
        track_data = json.loads(content)

    # Update track
    track.title = track_data.get("title", track.title)
    track.description = track_data.get("description")
    track.docker_image = track_data.get("docker_image", track.docker_image)
    track.tags = track_data.get("tags", [])
    track.difficulty = track_data.get("difficulty", "beginner")
    track.estimated_minutes = track_data.get("estimated_minutes")
    track.env_template = track_data.get("env_template", [])

    # Update steps
    # First, delete existing steps
    for step in track.steps:
        db.delete(step)

    # Create new steps
    for step_data in track_data.get("steps", []):
        step = models.Step(
            track_id=track.id,
            order=step_data["order"],
            title=step_data["title"],
            instructions_md=step_data.get("instructions_md", ""),
            setup_script=step_data.get("setup_script", ""),
            validation_script=step_data.get("validation_script", ""),
            hints=step_data.get("hints", [])
        )
        db.add(step)

    # Update sync status
    sync.last_sync_at = datetime.utcnow()
    sync.last_sync_sha = sha

    db.commit()

    return {
        "message": "Track pulled from GitHub",
        "commit_sha": sha
    }


@router.delete("/tracks/{slug}/sync")
def remove_track_sync(
    slug: str,
    current_user: models.User = Depends(auth.get_current_author),
    db: Session = Depends(get_db)
):
    """Remove GitHub sync configuration for a track"""
    track = db.query(models.Track).filter(
        models.Track.slug == slug,
        models.Track.author_id == current_user.id
    ).first()

    if not track:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Track not found"
        )

    sync = db.query(models.TrackGitSync).filter(
        models.TrackGitSync.track_id == track.id
    ).first()

    if not sync:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sync not configured"
        )

    db.delete(sync)
    db.commit()

    return {"message": "Sync removed"}
