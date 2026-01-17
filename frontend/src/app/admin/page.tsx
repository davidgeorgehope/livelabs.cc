"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { admin, infrastructure, SystemStats, AdminUser, AdminOrganization, TrackImage, DiskUsage } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Shield,
  Users,
  Building2,
  BookOpen,
  Activity,
  TrendingUp,
  Search,
  Check,
  X,
  HardDrive,
  Download,
  Trash2,
  RefreshCw,
  Loader2,
  Clock,
  UserCheck,
  UserX,
} from "lucide-react";

export default function AdminDashboardPage() {
  const router = useRouter();
  const { user, token, isLoading: authLoading } = useAuth();
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [organizations, setOrganizations] = useState<AdminOrganization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState("");
  const [orgSearch, setOrgSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"overview" | "pending" | "users" | "organizations" | "infrastructure">("overview");
  const [trackImages, setTrackImages] = useState<TrackImage[]>([]);
  const [diskUsage, setDiskUsage] = useState<DiskUsage | null>(null);
  const [pullingImages, setPullingImages] = useState<Set<string>>(new Set());
  const [infraLoading, setInfraLoading] = useState(false);
  const [pendingUsers, setPendingUsers] = useState<AdminUser[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
      return;
    }
    if (!authLoading && user && !user.is_admin) {
      router.push("/");
      return;
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (token) {
      Promise.all([
        admin.getStats(token),
        admin.listUsers(token),
        admin.listOrganizations(token),
      ])
        .then(([statsData, usersData, orgsData]) => {
          setStats(statsData);
          setUsers(usersData);
          setOrganizations(orgsData);
        })
        .catch((err) => setError(err instanceof Error ? err.message : "Failed to load data"))
        .finally(() => setIsLoading(false));
    }
  }, [token]);

  const handleUserSearch = async () => {
    if (!token) return;
    try {
      const results = await admin.listUsers(token, { search: userSearch });
      setUsers(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    }
  };

  const handleOrgSearch = async () => {
    if (!token) return;
    try {
      const results = await admin.listOrganizations(token, orgSearch);
      setOrganizations(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    }
  };

  const handleToggleAuthor = async (userId: number, currentValue: boolean) => {
    if (!token) return;
    try {
      const updated = await admin.updateUser(userId, { is_author: !currentValue }, token);
      setUsers(users.map((u) => (u.id === userId ? updated : u)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    }
  };

  const handleToggleActive = async (userId: number, currentValue: boolean) => {
    if (!token) return;
    try {
      const updated = await admin.updateUser(userId, { is_active: !currentValue }, token);
      setUsers(users.map((u) => (u.id === userId ? updated : u)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    }
  };

  const loadPendingUsers = async () => {
    if (!token) return;
    setPendingLoading(true);
    try {
      const pending = await admin.listPendingUsers(token);
      setPendingUsers(pending);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load pending users");
    } finally {
      setPendingLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "pending" && token && pendingUsers.length === 0) {
      loadPendingUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, token]);

  const handleApproveUser = async (userId: number) => {
    if (!token) return;
    try {
      await admin.approveUser(userId, token);
      setPendingUsers(pendingUsers.filter((u) => u.id !== userId));
      // Refresh stats to update pending count
      const newStats = await admin.getStats(token);
      setStats(newStats);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approval failed");
    }
  };

  const handleRejectUser = async (userId: number) => {
    if (!token) return;
    const reason = rejectReason || null;
    try {
      await admin.rejectUser(userId, reason, token);
      setPendingUsers(pendingUsers.filter((u) => u.id !== userId));
      setRejectReason("");
      // Refresh stats to update pending count
      const newStats = await admin.getStats(token);
      setStats(newStats);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rejection failed");
    }
  };

  const loadInfraData = async () => {
    if (!token) return;
    setInfraLoading(true);
    try {
      const [images, usage] = await Promise.all([
        infrastructure.getTrackImages(token),
        infrastructure.getDiskUsage(token),
      ]);
      setTrackImages(images);
      setDiskUsage(usage);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load infrastructure data");
    } finally {
      setInfraLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "infrastructure" && token && trackImages.length === 0) {
      loadInfraData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, token]);

  const handlePullImage = async (image: string) => {
    if (!token) return;
    setPullingImages((prev) => new Set(prev).add(image));
    try {
      await infrastructure.pullImage(image, true, token);
      // Poll for status
      const checkStatus = async () => {
        const status = await infrastructure.getImageStatus(image, token);
        if (status.status === "pulling") {
          setTimeout(checkStatus, 2000);
        } else {
          setPullingImages((prev) => {
            const next = new Set(prev);
            next.delete(image);
            return next;
          });
          loadInfraData();
        }
      };
      setTimeout(checkStatus, 2000);
    } catch (err) {
      setPullingImages((prev) => {
        const next = new Set(prev);
        next.delete(image);
        return next;
      });
      setError(err instanceof Error ? err.message : "Failed to pull image");
    }
  };

  const handleWarmupAll = async () => {
    if (!token) return;
    setInfraLoading(true);
    try {
      await infrastructure.warmupTrackImages(token);
      const uncached = trackImages.filter((t) => !t.cached).map((t) => t.image);
      setPullingImages(new Set(uncached));
      // Start polling
      const checkAll = async () => {
        const images = await infrastructure.getTrackImages(token);
        const stillPulling = images.filter((t) => !t.cached).map((t) => t.image);
        if (stillPulling.length > 0) {
          setPullingImages(new Set(stillPulling));
          setTimeout(checkAll, 3000);
        } else {
          setPullingImages(new Set());
          setTrackImages(images);
          setInfraLoading(false);
        }
      };
      setTimeout(checkAll, 3000);
    } catch (err) {
      setInfraLoading(false);
      setError(err instanceof Error ? err.message : "Failed to warmup images");
    }
  };

  const handlePrune = async () => {
    if (!token) return;
    if (!confirm("This will remove unused Docker images and containers. Continue?")) return;
    try {
      const result = await infrastructure.prune(token);
      alert(`Cleaned up: ${result.images_removed} images, ${result.containers_removed} containers. Reclaimed ${result.space_reclaimed_mb} MB.`);
      loadInfraData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Prune failed");
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-muted-foreground">Loading admin dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="flex items-center gap-3 mb-8">
        <Shield className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground">System management and monitoring</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {(["overview", "pending", "users", "organizations", "infrastructure"] as const).map((tab) => (
          <Button
            key={tab}
            variant={activeTab === tab ? "default" : "outline"}
            onClick={() => setActiveTab(tab)}
            className="relative"
          >
            {tab === "overview" && <Activity className="h-4 w-4 mr-2" />}
            {tab === "pending" && <Clock className="h-4 w-4 mr-2" />}
            {tab === "users" && <Users className="h-4 w-4 mr-2" />}
            {tab === "organizations" && <Building2 className="h-4 w-4 mr-2" />}
            {tab === "infrastructure" && <HardDrive className="h-4 w-4 mr-2" />}
            {tab === "pending" ? "Pending Approval" : tab.charAt(0).toUpperCase() + tab.slice(1)}
            {tab === "pending" && stats && stats.pending_users > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                {stats.pending_users}
              </span>
            )}
          </Button>
        ))}
      </div>

      {activeTab === "overview" && stats && (
        <div className="space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Users</p>
                    <p className="text-3xl font-bold">{stats.total_users}</p>
                  </div>
                  <Users className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {stats.total_authors} authors, {stats.total_admins} admins
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Organizations</p>
                    <p className="text-3xl font-bold">{stats.total_organizations}</p>
                  </div>
                  <Building2 className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Tracks</p>
                    <p className="text-3xl font-bold">{stats.total_tracks}</p>
                  </div>
                  <BookOpen className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {stats.published_tracks} published
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Enrollments</p>
                    <p className="text-3xl font-bold">{stats.total_enrollments}</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {stats.completed_enrollments} completed
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Activity Stats */}
          <Card>
            <CardHeader>
              <CardTitle>Activity (Last 7 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-muted rounded-lg">
                  <p className="text-3xl font-bold">{stats.active_users_7d}</p>
                  <p className="text-sm text-muted-foreground">Active Users</p>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <p className="text-3xl font-bold">{stats.new_users_7d}</p>
                  <p className="text-sm text-muted-foreground">New Signups</p>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <p className="text-3xl font-bold">{stats.total_executions}</p>
                  <p className="text-sm text-muted-foreground">Total Executions</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "pending" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Pending User Approvals</CardTitle>
                <CardDescription>Review and approve new user registrations</CardDescription>
              </div>
              <Button variant="outline" onClick={loadPendingUsers} disabled={pendingLoading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${pendingLoading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {pendingLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                Loading pending users...
              </div>
            ) : pendingUsers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <UserCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No pending user approvals</p>
                <p className="text-sm mt-1">All caught up!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingUsers.map((u) => (
                  <div key={u.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-medium">{u.name}</h3>
                        <p className="text-sm text-muted-foreground">{u.email}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Organization: {u.organization_name || "Personal"} |
                          Registered: {new Date(u.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="default"
                          className="bg-green-600 hover:bg-green-700"
                          onClick={() => handleApproveUser(u.id)}
                        >
                          <UserCheck className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleRejectUser(u.id)}
                        >
                          <UserX className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "users" && (
        <Card>
          <CardHeader>
            <CardTitle>User Management</CardTitle>
            <CardDescription>Manage user roles and status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 mb-4">
              <Input
                placeholder="Search by email or name..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleUserSearch()}
              />
              <Button onClick={handleUserSearch}>
                <Search className="h-4 w-4" />
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">User</th>
                    <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">Organization</th>
                    <th className="text-center py-3 px-2 text-sm font-medium text-muted-foreground">Author</th>
                    <th className="text-center py-3 px-2 text-sm font-medium text-muted-foreground">Admin</th>
                    <th className="text-center py-3 px-2 text-sm font-medium text-muted-foreground">Active</th>
                    <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">Stats</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="py-3 px-2">
                        <div>
                          <p className="font-medium">{u.name}</p>
                          <p className="text-sm text-muted-foreground">{u.email}</p>
                        </div>
                      </td>
                      <td className="py-3 px-2 text-sm">{u.organization_name || "-"}</td>
                      <td className="py-3 px-2 text-center">
                        <button
                          onClick={() => handleToggleAuthor(u.id, u.is_author)}
                          className={`p-1 rounded ${u.is_author ? "text-green-600" : "text-muted-foreground"}`}
                        >
                          {u.is_author ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                        </button>
                      </td>
                      <td className="py-3 px-2 text-center">
                        <span className={u.is_admin ? "text-green-600" : "text-muted-foreground"}>
                          {u.is_admin ? <Check className="h-4 w-4 inline" /> : <X className="h-4 w-4 inline" />}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-center">
                        <button
                          onClick={() => handleToggleActive(u.id, u.is_active)}
                          className={`p-1 rounded ${u.is_active ? "text-green-600" : "text-red-600"}`}
                        >
                          {u.is_active ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                        </button>
                      </td>
                      <td className="py-3 px-2 text-right text-sm text-muted-foreground">
                        {u.tracks_count} tracks, {u.enrollments_count} enrollments
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === "organizations" && (
        <Card>
          <CardHeader>
            <CardTitle>Organization Management</CardTitle>
            <CardDescription>View and manage organizations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 mb-4">
              <Input
                placeholder="Search organizations..."
                value={orgSearch}
                onChange={(e) => setOrgSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleOrgSearch()}
              />
              <Button onClick={handleOrgSearch}>
                <Search className="h-4 w-4" />
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">Organization</th>
                    <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">Slug</th>
                    <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">Users</th>
                    <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">Tracks</th>
                    <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {organizations.map((org) => (
                    <tr key={org.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="py-3 px-2 font-medium">{org.name}</td>
                      <td className="py-3 px-2 text-sm text-muted-foreground">{org.slug}</td>
                      <td className="py-3 px-2 text-right">{org.users_count}</td>
                      <td className="py-3 px-2 text-right">{org.tracks_count}</td>
                      <td className="py-3 px-2 text-right text-sm text-muted-foreground">
                        {new Date(org.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === "infrastructure" && (
        <div className="space-y-6">
          {/* Disk Usage */}
          {diskUsage && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Images</p>
                      <p className="text-2xl font-bold">{diskUsage.images.count}</p>
                    </div>
                    <HardDrive className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {diskUsage.images.size_mb} MB used, {diskUsage.images.reclaimable_mb} MB reclaimable
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Containers</p>
                      <p className="text-2xl font-bold">{diskUsage.containers.count}</p>
                    </div>
                    <Activity className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {diskUsage.containers.size_mb} MB used
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Volumes</p>
                      <p className="text-2xl font-bold">{diskUsage.volumes.count}</p>
                    </div>
                    <HardDrive className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {diskUsage.volumes.size_mb} MB used
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Track Images */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Docker Images</CardTitle>
                  <CardDescription>Manage container images used by tracks</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={loadInfraData} disabled={infraLoading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${infraLoading ? "animate-spin" : ""}`} />
                    Refresh
                  </Button>
                  <Button variant="outline" onClick={handleWarmupAll} disabled={infraLoading}>
                    <Download className="h-4 w-4 mr-2" />
                    Warmup All
                  </Button>
                  <Button variant="outline" onClick={handlePrune}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Prune Unused
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {infraLoading && trackImages.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                  Loading infrastructure data...
                </div>
              ) : trackImages.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No tracks found with Docker images configured.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">Image</th>
                        <th className="text-center py-3 px-2 text-sm font-medium text-muted-foreground">Cached</th>
                        <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">Size</th>
                        <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">Tracks</th>
                        <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trackImages.map((img) => (
                        <tr key={img.image} className="border-b last:border-0 hover:bg-muted/50">
                          <td className="py-3 px-2">
                            <code className="text-sm bg-muted px-2 py-1 rounded">{img.image}</code>
                          </td>
                          <td className="py-3 px-2 text-center">
                            {pullingImages.has(img.image) ? (
                              <Loader2 className="h-4 w-4 animate-spin inline text-blue-500" />
                            ) : img.cached ? (
                              <Check className="h-4 w-4 inline text-green-600" />
                            ) : (
                              <X className="h-4 w-4 inline text-muted-foreground" />
                            )}
                          </td>
                          <td className="py-3 px-2 text-right text-sm">
                            {img.cached ? `${img.size_mb} MB` : "-"}
                          </td>
                          <td className="py-3 px-2 text-right">
                            <span className="text-sm" title={img.tracks.map((t) => t.title).join(", ")}>
                              {img.track_count} track{img.track_count !== 1 ? "s" : ""}
                            </span>
                          </td>
                          <td className="py-3 px-2 text-right">
                            {!img.cached && !pullingImages.has(img.image) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handlePullImage(img.image)}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
