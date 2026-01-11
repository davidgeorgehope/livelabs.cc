"""Analytics endpoints for track authors"""
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func, and_

from .. import models, auth
from ..database import get_db

router = APIRouter(prefix="/analytics", tags=["analytics"])


# Response schemas
class StepAnalytics(BaseModel):
    step_id: int
    step_order: int
    step_title: str
    attempts: int
    completions: int
    completion_rate: float
    avg_attempts: float
    avg_duration_ms: Optional[int]
    common_errors: list[str]


class TrackAnalytics(BaseModel):
    track_id: int
    track_title: str
    track_slug: str
    total_enrollments: int
    active_enrollments: int
    completions: int
    completion_rate: float
    avg_completion_time_hours: Optional[float]
    steps: list[StepAnalytics]


class TrackSummary(BaseModel):
    track_id: int
    track_title: str
    track_slug: str
    enrollments: int
    completions: int
    completion_rate: float


class OverviewAnalytics(BaseModel):
    total_tracks: int
    published_tracks: int
    total_enrollments: int
    total_completions: int
    tracks: list[TrackSummary]


class TimeSeriesPoint(BaseModel):
    date: str
    enrollments: int
    completions: int


class EnrollmentTimeline(BaseModel):
    track_id: int
    track_title: str
    data: list[TimeSeriesPoint]


@router.get("/overview", response_model=OverviewAnalytics)
def get_overview_analytics(
    current_user: models.User = Depends(auth.get_current_author),
    db: Session = Depends(get_db)
):
    """Get overview analytics for all tracks owned by the author"""
    # Get all tracks by this author
    tracks = db.query(models.Track).filter(
        models.Track.author_id == current_user.id
    ).all()

    track_summaries = []
    total_enrollments = 0
    total_completions = 0

    for track in tracks:
        enrollments = db.query(models.Enrollment).filter(
            models.Enrollment.track_id == track.id
        ).count()

        completions = db.query(models.Enrollment).filter(
            models.Enrollment.track_id == track.id,
            models.Enrollment.completed_at.isnot(None)
        ).count()

        total_enrollments += enrollments
        total_completions += completions

        completion_rate = (completions / enrollments * 100) if enrollments > 0 else 0

        track_summaries.append(TrackSummary(
            track_id=track.id,
            track_title=track.title,
            track_slug=track.slug,
            enrollments=enrollments,
            completions=completions,
            completion_rate=round(completion_rate, 1)
        ))

    # Sort by enrollments descending
    track_summaries.sort(key=lambda x: x.enrollments, reverse=True)

    return OverviewAnalytics(
        total_tracks=len(tracks),
        published_tracks=sum(1 for t in tracks if t.is_published),
        total_enrollments=total_enrollments,
        total_completions=total_completions,
        tracks=track_summaries
    )


@router.get("/tracks/{slug}", response_model=TrackAnalytics)
def get_track_analytics(
    slug: str,
    current_user: models.User = Depends(auth.get_current_author),
    db: Session = Depends(get_db)
):
    """Get detailed analytics for a specific track"""
    track = db.query(models.Track).filter(
        models.Track.slug == slug,
        models.Track.author_id == current_user.id
    ).first()

    if not track:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Track not found"
        )

    # Get enrollment stats
    total_enrollments = db.query(models.Enrollment).filter(
        models.Enrollment.track_id == track.id
    ).count()

    active_enrollments = db.query(models.Enrollment).filter(
        models.Enrollment.track_id == track.id,
        models.Enrollment.completed_at.is_(None)
    ).count()

    completions = db.query(models.Enrollment).filter(
        models.Enrollment.track_id == track.id,
        models.Enrollment.completed_at.isnot(None)
    ).count()

    completion_rate = (completions / total_enrollments * 100) if total_enrollments > 0 else 0

    # Calculate average completion time
    completed_enrollments = db.query(models.Enrollment).filter(
        models.Enrollment.track_id == track.id,
        models.Enrollment.completed_at.isnot(None)
    ).all()

    avg_completion_time = None
    if completed_enrollments:
        total_hours = sum(
            (e.completed_at - e.started_at).total_seconds() / 3600
            for e in completed_enrollments
        )
        avg_completion_time = round(total_hours / len(completed_enrollments), 1)

    # Get step-level analytics
    step_analytics = []
    for step in sorted(track.steps, key=lambda s: s.order):
        # Count validation attempts for this step
        attempts = db.query(models.Execution).join(models.Enrollment).filter(
            models.Enrollment.track_id == track.id,
            models.Execution.step_id == step.id,
            models.Execution.script_type == "validation"
        ).count()

        # Count successful validations
        successful = db.query(models.Execution).join(models.Enrollment).filter(
            models.Enrollment.track_id == track.id,
            models.Execution.step_id == step.id,
            models.Execution.script_type == "validation",
            models.Execution.status == "success"
        ).count()

        # Count unique users who completed this step
        # (reached a step beyond this one or completed the track)
        step_completions = db.query(models.Enrollment).filter(
            models.Enrollment.track_id == track.id,
            models.Enrollment.current_step > step.order
        ).count()

        step_completion_rate = (step_completions / total_enrollments * 100) if total_enrollments > 0 else 0

        # Average attempts per completion
        avg_attempts = (attempts / step_completions) if step_completions > 0 else 0

        # Average duration for successful validations
        avg_duration = db.query(func.avg(models.Execution.duration_ms)).join(models.Enrollment).filter(
            models.Enrollment.track_id == track.id,
            models.Execution.step_id == step.id,
            models.Execution.script_type == "validation",
            models.Execution.status == "success"
        ).scalar()

        # Get common errors (failed validations)
        failed_executions = db.query(models.Execution).join(models.Enrollment).filter(
            models.Enrollment.track_id == track.id,
            models.Execution.step_id == step.id,
            models.Execution.script_type == "validation",
            models.Execution.status == "failed",
            models.Execution.stderr != ""
        ).order_by(models.Execution.started_at.desc()).limit(10).all()

        # Extract unique error messages (first line of stderr)
        error_counts: dict[str, int] = {}
        for exec in failed_executions:
            if exec.stderr:
                first_line = exec.stderr.strip().split('\n')[0][:100]
                error_counts[first_line] = error_counts.get(first_line, 0) + 1

        # Get top 3 errors
        common_errors = sorted(error_counts.keys(), key=lambda k: error_counts[k], reverse=True)[:3]

        step_analytics.append(StepAnalytics(
            step_id=step.id,
            step_order=step.order,
            step_title=step.title,
            attempts=attempts,
            completions=step_completions,
            completion_rate=round(step_completion_rate, 1),
            avg_attempts=round(avg_attempts, 1),
            avg_duration_ms=int(avg_duration) if avg_duration else None,
            common_errors=common_errors
        ))

    return TrackAnalytics(
        track_id=track.id,
        track_title=track.title,
        track_slug=track.slug,
        total_enrollments=total_enrollments,
        active_enrollments=active_enrollments,
        completions=completions,
        completion_rate=round(completion_rate, 1),
        avg_completion_time_hours=avg_completion_time,
        steps=step_analytics
    )


@router.get("/tracks/{slug}/timeline", response_model=EnrollmentTimeline)
def get_track_timeline(
    slug: str,
    days: int = 30,
    current_user: models.User = Depends(auth.get_current_author),
    db: Session = Depends(get_db)
):
    """Get enrollment/completion timeline for a track"""
    track = db.query(models.Track).filter(
        models.Track.slug == slug,
        models.Track.author_id == current_user.id
    ).first()

    if not track:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Track not found"
        )

    # Limit to max 90 days
    days = min(days, 90)
    start_date = datetime.utcnow() - timedelta(days=days)

    # Get daily enrollment counts
    enrollments = db.query(models.Enrollment).filter(
        models.Enrollment.track_id == track.id,
        models.Enrollment.started_at >= start_date
    ).all()

    completions = db.query(models.Enrollment).filter(
        models.Enrollment.track_id == track.id,
        models.Enrollment.completed_at >= start_date
    ).all()

    # Build daily counts
    daily_data: dict[str, dict] = {}
    for i in range(days):
        date = (start_date + timedelta(days=i)).strftime("%Y-%m-%d")
        daily_data[date] = {"enrollments": 0, "completions": 0}

    for e in enrollments:
        date = e.started_at.strftime("%Y-%m-%d")
        if date in daily_data:
            daily_data[date]["enrollments"] += 1

    for e in completions:
        if e.completed_at:
            date = e.completed_at.strftime("%Y-%m-%d")
            if date in daily_data:
                daily_data[date]["completions"] += 1

    timeline_data = [
        TimeSeriesPoint(
            date=date,
            enrollments=data["enrollments"],
            completions=data["completions"]
        )
        for date, data in sorted(daily_data.items())
    ]

    return EnrollmentTimeline(
        track_id=track.id,
        track_title=track.title,
        data=timeline_data
    )


@router.get("/tracks/{slug}/dropoff")
def get_dropoff_analysis(
    slug: str,
    current_user: models.User = Depends(auth.get_current_author),
    db: Session = Depends(get_db)
):
    """Analyze where learners drop off in a track"""
    track = db.query(models.Track).filter(
        models.Track.slug == slug,
        models.Track.author_id == current_user.id
    ).first()

    if not track:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Track not found"
        )

    total_enrollments = db.query(models.Enrollment).filter(
        models.Enrollment.track_id == track.id
    ).count()

    if total_enrollments == 0:
        return {"steps": [], "total_enrollments": 0}

    # For each step, count how many learners are currently stuck there
    step_data = []
    for step in sorted(track.steps, key=lambda s: s.order):
        # Count learners who stopped at this step (active enrollments at this step)
        stuck_count = db.query(models.Enrollment).filter(
            models.Enrollment.track_id == track.id,
            models.Enrollment.current_step == step.order,
            models.Enrollment.completed_at.is_(None)
        ).count()

        # Count learners who passed this step
        passed_count = db.query(models.Enrollment).filter(
            models.Enrollment.track_id == track.id,
            models.Enrollment.current_step > step.order
        ).count()

        step_data.append({
            "step_order": step.order,
            "step_title": step.title,
            "stuck": stuck_count,
            "passed": passed_count,
            "dropoff_rate": round(stuck_count / total_enrollments * 100, 1) if total_enrollments > 0 else 0
        })

    return {
        "total_enrollments": total_enrollments,
        "steps": step_data
    }
