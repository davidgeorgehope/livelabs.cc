"""Infrastructure management for Docker images and container pooling"""
import threading
import time
from typing import Optional
from datetime import datetime
import docker
from docker.errors import ImageNotFound, APIError


class ImageManager:
    """Manages Docker image pre-pulling and caching"""

    def __init__(self):
        self._client = None
        self._pull_status: dict[str, dict] = {}
        self._lock = threading.Lock()

    @property
    def client(self):
        if self._client is None:
            self._client = docker.from_env()
        return self._client

    def get_image_status(self, image: str) -> dict:
        """Check if an image is available locally"""
        try:
            img = self.client.images.get(image)
            return {
                "image": image,
                "status": "available",
                "size_mb": round(img.attrs.get("Size", 0) / (1024 * 1024), 2),
                "created": img.attrs.get("Created"),
                "id": img.short_id
            }
        except ImageNotFound:
            with self._lock:
                if image in self._pull_status:
                    return self._pull_status[image]
            return {
                "image": image,
                "status": "not_found",
                "size_mb": 0,
                "created": None,
                "id": None
            }
        except APIError as e:
            return {
                "image": image,
                "status": "error",
                "error": str(e)
            }

    def list_cached_images(self) -> list[dict]:
        """List all locally available images"""
        try:
            images = self.client.images.list()
            result = []
            for img in images:
                tags = img.tags
                if not tags:
                    continue
                for tag in tags:
                    result.append({
                        "image": tag,
                        "size_mb": round(img.attrs.get("Size", 0) / (1024 * 1024), 2),
                        "created": img.attrs.get("Created"),
                        "id": img.short_id
                    })
            return result
        except APIError:
            return []

    def pull_image(self, image: str) -> dict:
        """Pull an image synchronously"""
        with self._lock:
            self._pull_status[image] = {
                "image": image,
                "status": "pulling",
                "started_at": datetime.utcnow().isoformat()
            }

        try:
            self.client.images.pull(image)
            status = self.get_image_status(image)
            with self._lock:
                self._pull_status[image] = status
            return status
        except ImageNotFound:
            status = {
                "image": image,
                "status": "not_found",
                "error": f"Image {image} not found in registry"
            }
            with self._lock:
                self._pull_status[image] = status
            return status
        except APIError as e:
            status = {
                "image": image,
                "status": "error",
                "error": str(e)
            }
            with self._lock:
                self._pull_status[image] = status
            return status

    def pull_image_async(self, image: str) -> dict:
        """Start pulling an image in the background"""
        with self._lock:
            if image in self._pull_status and self._pull_status[image].get("status") == "pulling":
                return self._pull_status[image]

        def _pull():
            self.pull_image(image)

        thread = threading.Thread(target=_pull, daemon=True)
        thread.start()

        with self._lock:
            self._pull_status[image] = {
                "image": image,
                "status": "pulling",
                "started_at": datetime.utcnow().isoformat()
            }
            return self._pull_status[image]

    def get_pull_status(self, image: str) -> Optional[dict]:
        """Get the current pull status for an image"""
        with self._lock:
            return self._pull_status.get(image)

    def remove_image(self, image: str, force: bool = False) -> dict:
        """Remove a cached image"""
        try:
            self.client.images.remove(image, force=force)
            with self._lock:
                if image in self._pull_status:
                    del self._pull_status[image]
            return {"image": image, "status": "removed"}
        except ImageNotFound:
            return {"image": image, "status": "not_found"}
        except APIError as e:
            return {"image": image, "status": "error", "error": str(e)}

    def warmup_images(self, images: list[str]) -> dict:
        """Pre-pull multiple images in background"""
        results = {}
        for image in images:
            results[image] = self.pull_image_async(image)
        return results

    def get_disk_usage(self) -> dict:
        """Get Docker disk usage information"""
        try:
            df = self.client.df()
            return {
                "images": {
                    "count": len(df.get("Images", [])),
                    "size_mb": round(sum(i.get("Size", 0) for i in df.get("Images", [])) / (1024 * 1024), 2),
                    "reclaimable_mb": round(sum(i.get("Size", 0) for i in df.get("Images", []) if i.get("Containers", 0) == 0) / (1024 * 1024), 2)
                },
                "containers": {
                    "count": len(df.get("Containers", [])),
                    "size_mb": round(sum(c.get("SizeRw", 0) for c in df.get("Containers", [])) / (1024 * 1024), 2)
                },
                "volumes": {
                    "count": len(df.get("Volumes", [])),
                    "size_mb": round(sum(v.get("UsageData", {}).get("Size", 0) for v in df.get("Volumes", [])) / (1024 * 1024), 2)
                }
            }
        except APIError:
            return {"error": "Failed to get disk usage"}

    def prune_unused(self) -> dict:
        """Remove unused images, containers, and volumes"""
        try:
            containers = self.client.containers.prune()
            images = self.client.images.prune()
            return {
                "containers_removed": len(containers.get("ContainersDeleted", []) or []),
                "images_removed": len(images.get("ImagesDeleted", []) or []),
                "space_reclaimed_mb": round(
                    (containers.get("SpaceReclaimed", 0) + images.get("SpaceReclaimed", 0)) / (1024 * 1024), 2
                )
            }
        except APIError as e:
            return {"error": str(e)}


# Global instance
image_manager = ImageManager()
