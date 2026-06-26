import { useEffect, useState, useMemo } from "react";
import { http } from "../services/http";
import ImageUpload from "../components/ImageUpload";
import PageWrapper from "../components/PageWrapper";
import {
  Star,
  UserPlus,
  Trash2,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  XCircle,
  User,
  Calendar,
  Plus,
  Users,
  Image,
  Eye,
  EyeOff,
  Sparkles,
  Music,
  TrendingUp,
  Award,
  Crown,
  Zap
} from "lucide-react";

type Artist = {
  id: number;
  name: string;
  profileImageUrl: string | null;
  isVerified: boolean;
};

type FeaturedArtist = {
  id: number;
  artistId: number | null;
  name: string;
  avatar: string | null;
  isActive: boolean;
  createdAt: string;
};

export default function AdminFeaturedArtistsPage() {
  const [artists, setArtists] = useState<Artist[]>([]);
  const [featured, setFeatured] = useState<FeaturedArtist[]>([]);
  const [selectedArtistId, setSelectedArtistId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [addMode, setAddMode] = useState<"existing" | "manual">("existing");
  const [manualName, setManualName] = useState<string>("");
  const [manualAvatar, setManualAvatar] = useState<string>("");

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [artistsRes, featuredRes] = await Promise.all([
        http.get("/api/v1/admin/artists"),
        http.get("/api/v1/admin/featured-artists"),
      ]);

      const artistsData = artistsRes.data?.items || [];
      const featuredData = featuredRes.data?.featured || [];
      
      setArtists(artistsData);
      setFeatured(featuredData);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddFeatured = async () => {
    setIsAdding(true);
    setError(null);
    try {
      let payload;
      
      if (addMode === "existing") {
        if (!selectedArtistId) {
          setError("Please select an artist");
          setIsAdding(false);
          return;
        }
        payload = { artistId: Number(selectedArtistId) };
      } else {
        if (!manualName.trim() || !manualAvatar.trim()) {
          setError("Name and avatar URL are required");
          setIsAdding(false);
          return;
        }
        payload = { 
          name: manualName.trim(), 
          avatar: manualAvatar.trim() 
        };
      }
      
      await http.post("/api/v1/admin/featured-artists", payload);
      
      setSelectedArtistId("");
      setManualName("");
      setManualAvatar("");
      
      await loadData();
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to add featured artist");
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemove = async (id: number) => {
    if (!confirm("Remove this artist from featured?")) return;

    setIsLoading(true);
    try {
      await http.delete(`/api/v1/admin/featured-artists/${id}`);
      await loadData();
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to remove");
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleActive = async (id: number, currentStatus: boolean) => {
    try {
      await http.patch(`/api/v1/admin/featured-artists/${id}`, {
        isActive: !currentStatus,
      });
      await loadData();
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to update status");
    }
  };

  const availableArtists = artists.filter(
    (a) => !featured.some((f) => f.artistId === a.id)
  );

  const activeCount = featured.filter(f => f.isActive).length;
  const inactiveCount = featured.filter(f => !f.isActive).length;

  return (
    <PageWrapper 
      title="Featured Artists" 
      subtitle="Curate and manage artists showcased on the fan app home screen"
    >
      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="group relative overflow-hidden rounded-2xl border border-white/5 bg-[#15100E] p-5 hover:border-white/10 transition-all duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-[#E85D2C]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[#8D7B77]">Total Featured</p>
                <p className="mt-1.5 text-3xl font-bold text-white">{featured.length}</p>
              </div>
              <div className="p-3 rounded-xl bg-[#E85D2C]/10">
                <Star size={20} className="text-[#E85D2C]" />
              </div>
            </div>
          </div>
        </div>

        <div className="group relative overflow-hidden rounded-2xl border border-white/5 bg-[#15100E] p-5 hover:border-white/10 transition-all duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[#8D7B77]">Active</p>
                <p className="mt-1.5 text-3xl font-bold text-green-400">{activeCount}</p>
              </div>
              <div className="p-3 rounded-xl bg-green-500/10">
                <CheckCircle size={20} className="text-green-400" />
              </div>
            </div>
          </div>
        </div>

        <div className="group relative overflow-hidden rounded-2xl border border-white/5 bg-[#15100E] p-5 hover:border-white/10 transition-all duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[#8D7B77]">Inactive</p>
                <p className="mt-1.5 text-3xl font-bold text-red-400">{inactiveCount}</p>
              </div>
              <div className="p-3 rounded-xl bg-red-500/10">
                <XCircle size={20} className="text-red-400" />
              </div>
            </div>
          </div>
        </div>

        <div className="group relative overflow-hidden rounded-2xl border border-white/5 bg-[#15100E] p-5 hover:border-white/10 transition-all duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[#8D7B77]">Available</p>
                <p className="mt-1.5 text-3xl font-bold text-blue-400">{availableArtists.length}</p>
              </div>
              <div className="p-3 rounded-xl bg-blue-500/10">
                <Users size={20} className="text-blue-400" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/5 px-5 py-4 flex items-start gap-3">
          <AlertCircle size={18} className="text-red-400 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-400">Error</p>
            <p className="text-sm text-red-300/80">{error}</p>
          </div>
        </div>
      )}

      {/* Add Featured Artist Section */}
      <div className="rounded-2xl border border-white/5 bg-[#15100E] p-6 mb-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#E85D2C]/20 to-[#C97A54]/10">
            <Zap size={20} className="text-[#E85D2C]" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Add Featured Artist</h2>
            <p className="text-sm text-[#8D7B77]">Select an existing artist or create a new one</p>
          </div>
        </div>

        <div className="flex gap-2 mb-5">
          <button
            onClick={() => setAddMode("existing")}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              addMode === "existing"
                ? "bg-[#E85D2C]/10 text-[#E85D2C] border border-[#E85D2C]/20"
                : "text-[#8D7B77] hover:text-white hover:bg-white/5"
            }`}
          >
            <Users size={14} className="inline mr-2" />
            Existing Artist
          </button>
          <button
            onClick={() => setAddMode("manual")}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              addMode === "manual"
                ? "bg-[#E85D2C]/10 text-[#E85D2C] border border-[#E85D2C]/20"
                : "text-[#8D7B77] hover:text-white hover:bg-white/5"
            }`}
          >
            <UserPlus size={14} className="inline mr-2" />
            Create New
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center gap-3 py-8">
            <div className="w-5 h-5 border-2 border-[#E85D2C]/20 border-t-[#E85D2C] rounded-full animate-spin"></div>
            <span className="text-sm text-[#8D7B77]">Loading...</span>
          </div>
        ) : addMode === "existing" ? (
          artists.length === 0 ? (
            <div className="py-6 px-4 rounded-xl border border-yellow-500/20 bg-yellow-500/5">
              <div className="flex items-center gap-2 text-yellow-400">
                <AlertCircle size={16} />
                <span className="font-medium">No artists found</span>
              </div>
              <p className="text-sm text-[#8D7B77] mt-1 ml-6">Please add artists first before featuring them.</p>
            </div>
          ) : availableArtists.length === 0 ? (
            <div className="py-6 px-4 rounded-xl border border-blue-500/20 bg-blue-500/5">
              <div className="flex items-center gap-2 text-blue-400">
                <CheckCircle size={16} />
                <span className="font-medium">All artists are featured</span>
              </div>
              <p className="text-sm text-[#8D7B77] mt-1 ml-6">Remove some artists below or create a new one.</p>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <label className="block text-xs font-medium text-[#8D7B77] uppercase tracking-wider mb-1.5">
                  Select Artist
                </label>
                <select
                  value={selectedArtistId}
                  onChange={(e) => setSelectedArtistId(e.target.value)}
                  className="w-full h-[44px] rounded-xl bg-black/30 border border-white/10 px-4 text-white text-sm outline-none focus:border-[#E85D2C]/50 transition-all"
                  disabled={isAdding}
                >
                  <option value="">Choose an artist...</option>
                  {availableArtists.map((artist) => (
                    <option key={artist.id} value={artist.id}>
                      {artist.name} {artist.isVerified ? "✓" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleAddFeatured}
                disabled={!selectedArtistId || isAdding}
                className="h-[44px] px-8 rounded-xl bg-gradient-to-r from-[#E85D2C] to-[#C97A54] text-white font-medium hover:shadow-lg hover:shadow-[#E85D2C]/30 transition-all disabled:opacity-50 flex items-center gap-2 self-end"
              >
                {isAdding ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Adding...
                  </>
                ) : (
                  <>
                    <Plus size={18} />
                    Add to Featured
                  </>
                )}
              </button>
            </div>
          )
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#8D7B77] uppercase tracking-wider mb-1.5">
                Artist Name
              </label>
              <input
                type="text"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                placeholder="Enter artist name..."
                className="w-full h-[44px] rounded-xl bg-black/30 border border-white/10 px-4 text-white text-sm outline-none focus:border-[#E85D2C]/50 transition-all"
                disabled={isAdding}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#8D7B77] uppercase tracking-wider mb-1.5">
                Avatar Image
              </label>
              <ImageUpload
                onImageUploaded={setManualAvatar}
                currentImage={manualAvatar}
              />
            </div>
            <button
              onClick={handleAddFeatured}
              disabled={!manualName.trim() || !manualAvatar.trim() || isAdding}
              className="w-full h-[44px] rounded-xl bg-gradient-to-r from-[#E85D2C] to-[#C97A54] text-white font-medium hover:shadow-lg hover:shadow-[#E85D2C]/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isAdding ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Creating...
                </>
              ) : (
                <>
                  <Plus size={18} />
                  Create & Add to Featured
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Featured Artists List */}
      <div className="rounded-2xl border border-white/5 bg-[#15100E] p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#E85D2C]/20 to-[#C97A54]/10">
              <Crown size={20} className="text-[#E85D2C]" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Featured Artists</h2>
              <p className="text-sm text-[#8D7B77]">
                {featured.length} artist{featured.length !== 1 ? 's' : ''} featured
                {activeCount > 0 && ` · ${activeCount} active`}
              </p>
            </div>
          </div>
          <button
            onClick={loadData}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-sm text-[#8D7B77] hover:text-white hover:bg-white/10 transition-all disabled:opacity-50"
          >
            <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-[#E85D2C]/20 border-t-[#E85D2C]"></div>
            <p className="text-sm text-[#8D7B77] mt-3">Loading featured artists...</p>
          </div>
        ) : featured.length === 0 ? (
          <div className="text-center py-16">
            <div className="inline-flex p-5 rounded-full bg-white/5 mb-4">
              <Star size={28} className="text-[#8D7B77]" />
            </div>
            <p className="text-base font-medium text-white">No featured artists yet</p>
            <p className="text-sm text-[#8D7B77] mt-1">Add artists using the form above</p>
          </div>
        ) : (
          <div className="space-y-3">
            {featured.map((item, index) => (
              <div
                key={item.id}
                className={`group flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-xl border transition-all duration-300 ${
                  item.isActive 
                    ? "border-white/5 hover:border-[#E85D2C]/30 hover:bg-white/5" 
                    : "border-white/5 opacity-60 hover:opacity-80 hover:bg-white/5"
                }`}
              >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="relative">
                    <div className="h-14 w-14 rounded-full bg-black/30 border border-white/10 overflow-hidden shrink-0">
                      {item.avatar ? (
                        <img
                          src={item.avatar}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[#8D7B77]">
                          <User size={24} />
                        </div>
                      )}
                    </div>
                    {item.isActive && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-green-500 border-2 border-[#15100E] flex items-center justify-center">
                        <CheckCircle size={12} className="text-white" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-white truncate">{item.name}</h3>
                      {item.isActive ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-500/10 text-green-400 border border-green-500/20">
                          <Eye size={10} />
                          Live
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-500/10 text-[#8D7B77] border border-gray-500/20">
                          <EyeOff size={10} />
                          Hidden
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Calendar size={12} className="text-[#8D7B77]" />
                      <span className="text-xs text-[#8D7B77]">
                        Added {new Date(item.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto pt-3 sm:pt-0 border-t border-white/5 sm:border-0">
                  <button
                    onClick={() => handleToggleActive(item.id, item.isActive)}
                    className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                      item.isActive
                        ? "bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20"
                        : "bg-gray-500/10 text-[#8D7B77] border border-gray-500/20 hover:bg-gray-500/20 hover:text-white"
                    }`}
                  >
                    {item.isActive ? 'Active' : 'Inactive'}
                  </button>
                  <button
                    onClick={() => handleRemove(item.id)}
                    className="p-2.5 rounded-xl text-red-400 hover:bg-red-500/10 transition-all"
                    title="Remove"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="mt-6 p-5 rounded-2xl border border-blue-500/20 bg-blue-500/5">
        <div className="flex items-start gap-3">
          <Sparkles size={18} className="text-blue-400 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-blue-400">How Featured Artists Work</h3>
            <ul className="mt-2 space-y-1 text-sm text-[#8D7B77]">
              <li className="flex items-start gap-2">
                <span className="text-blue-400">•</span>
                Artists appear in the "Featured" section on the fan app home screen
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400">•</span>
                You can select existing artists or create new ones manually
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400">•</span>
                Inactive artists remain in the database but won't display to fans
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400">•</span>
                Maximum of 10 featured artists are shown to users
              </li>
            </ul>
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}