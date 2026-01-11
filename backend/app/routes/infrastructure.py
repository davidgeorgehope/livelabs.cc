"""Infrastructure management endpoints for admins"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .. import models, auth
from ..database import get_db
from ..infrastructure import image_manager

router = APIRouter(prefix="/infrastructure", tags=["infrastructure"])


class ImagePullRequest(BaseModel):
    image: str


class WarmupRequest(BaseModel):
    images: list[str]


class ImageResponse(BaseModel):
    image: str
    status: str
    size_mb: Optional[float] = None
    created: Optional[str] = None
    id: Optional[str] = None
    error: Optional[str] = None


class DiskUsageResponse(BaseModel):
    images: dict
    containers: dict
    volumes: dict


@router.get("/images")
def list_cached_images(
    current_user: models.User = Depends(auth.get_current_admin),
):
    """List all locally cached Docker images"""
    return image_manager.list_cached_images()


@router.get("/images/{image:path}")
def get_image_status(
    image: str,
    current_user: models.User = Depends(auth.get_current_admin),
):
    """Get status of a specific Docker image"""
    return image_manager.get_image_status(image)


@router.post("/images/pull")
def pull_image(
    request: ImagePullRequest,
    background: bool = False,
    current_user: models.User = Depends(auth.get_current_admin),
):
    """Pull a Docker image (optionally in background)"""
    if background:
        return image_manager.pull_image_async(request.image)
    return image_manager.pull_image(request.image)


@router.post("/images/warmup")
def warmup_images(
    request: WarmupRequest,
    current_user: models.User = Depends(auth.get_current_admin),
):
    """Pre-pull multiple Docker images in background"""
    return image_manager.warmup_images(request.images)


@router.delete("/images/{image:path}")
def remove_image(
    image: str,
    force: bool = False,
    current_user: models.User = Depends(auth.get_current_admin),
):
    """Remove a cached Docker image"""
    return image_manager.remove_image(image, force=force)


@router.get("/disk-usage")
def get_disk_usage(
    current_user: models.User = Depends(auth.get_current_admin),
):
    """Get Docker disk usage information"""
    return image_manager.get_disk_usage()


@router.post("/prune")
def prune_unused(
    current_user: models.User = Depends(auth.get_current_admin),
):
    """Remove unused Docker images and containers"""
    return image_manager.prune_unused()


@router.get("/track-images")
def get_track_images(
    current_user: models.User = Depends(auth.get_current_admin),
    db: Session = Depends(get_db),
):
    """Get list of Docker images used by tracks with their cache status"""
    tracks = db.query(models.Track).all()

    image_usage = {}
    for track in tracks:
        image = track.docker_image or "livelabs-runner:latest"
        if image not in image_usage:
            image_usage[image] = {
                "image": image,
                "track_count": 0,
                "tracks": []
            }
        image_usage[image]["track_count"] += 1
        image_usage[image]["tracks"].append({
            "slug": track.slug,
            "title": track.title
        })

    # Add cache status for each image
    result = []
    for image, data in image_usage.items():
        status = image_manager.get_image_status(image)
        result.append({
            **data,
            "cached": status.get("status") == "available",
            "size_mb": status.get("size_mb", 0)
        })

    return sorted(result, key=lambda x: x["track_count"], reverse=True)


@router.post("/warmup-track-images")
def warmup_track_images(
    current_user: models.User = Depends(auth.get_current_admin),
    db: Session = Depends(get_db),
):
    """Pre-pull all Docker images used by tracks"""
    tracks = db.query(models.Track).all()

    images = set()
    for track in tracks:
        image = track.docker_image or "livelabs-runner:latest"
        images.add(image)

    return image_manager.warmup_images(list(images))
