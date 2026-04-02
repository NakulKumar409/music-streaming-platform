import { useEffect, useState, useMemo } from "react";
import { http } from "../services/http";
import ImageUpload from "../components/ImageUpload";

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
  const [debugInfo, setDebugInfo] = useState<string>("");
  
  // Mode toggle: 'existing' | 'manual'
  const [addMode, setAddMode] = useState<"existing" | "manual">("existing");
  
  // Manual artist form state
  const [manualName, setManualName] = useState<string>("");
  const [manualAvatar, setManualAvatar] = useState<string>("");

  // Fetch all artists and featured artists
  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      console.log("[Featured Artists] Loading data...");
      const [artistsRes, featuredRes] = await Promise.all([
        http.get("/api/v1/admin/artists"),
        http.get("/api/v1/admin/featured-artists"),
      ]);

      const artistsData = artistsRes.data?.items || [];
      const featuredData = featuredRes.data?.featured || [];
      
      console.log("[Featured Artists] Artists loaded:", artistsData.length, artistsData);
      console.log("[Featured Artists] Featured loaded:", featuredData.length, featuredData);
      
      setArtists(artistsData);
      setFeatured(featuredData);
      
      setDebugInfo(`Artists: ${artistsData.length}, Featured: ${featuredData.length}`);
    } catch (err: any) {
      console.error("[Featured Artists] Load error:", err);
      setError(err.response?.data?.message || "Failed to load data. Please check API connection.");
      setDebugInfo(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Add featured artist
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
        // Manual mode
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
      
      // Reset form
      setSelectedArtistId("");
      setManualName("");
      setManualAvatar("");
      
      await loadData();
    } catch (err: any) {
      console.error("[Featured Artists] Add error:", err);
      setError(err.response?.data?.message || "Failed to add featured artist");
    } finally {
      setIsAdding(false);
    }
  };

  // Remove featured artist
  const handleRemove = async (id: number) => {
    if (!confirm("Remove this artist from featured?")) return;

    setIsLoading(true);
    try {
      await http.delete(`/api/v1/admin/featured-artists/${id}`);
      await loadData();
    } catch (err: any) {
      console.error("[Featured Artists] Remove error:", err);
      setError(err.response?.data?.message || "Failed to remove");
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle active status
  const handleToggleActive = async (id: number, currentStatus: boolean) => {
    try {
      await http.patch(`/api/v1/admin/featured-artists/${id}`, {
        isActive: !currentStatus,
      });
      await loadData();
    } catch (err: any) {
      console.error("[Featured Artists] Toggle error:", err);
      setError(err.response?.data?.message || "Failed to update status");
    }
  };

  // Get available artists (not already featured)
  const availableArtists = artists.filter(
    (a) => !featured.some((f) => f.artistId === a.id)
  );

  // Debug logging
  console.log("[Featured Artists] Available artists:", availableArtists.length, availableArtists.map(a => ({id: a.id, name: a.name})));
  console.log("[Featured Artists] Featured artists:", featured.length);

  const backgroundStyle = useMemo(() => {
    return {
      backgroundImage: "url(/image_77cf67.jpg)",
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat"
    } as const;
  }, []);

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#4b1927] text-white">
      <div className="absolute inset-0 opacity-25" style={backgroundStyle} />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_10%,rgba(193,117,86,0.18)_0%,rgba(75,25,39,0.85)_55%,rgba(10,8,8,0.95)_100%)]" />

      <div className="relative mx-auto w-full max-w-[1200px] px-6 pb-12">
        <div className="pt-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Featured Artists</h1>
          <p className="text-white/60">Manage which artists appear in the Featured section on the fan app</p>
        </div>

        {/* Debug Panel */}
        <div className="mb-4 p-3 bg-gray-800/50 border border-gray-700 rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400 font-mono">{debugInfo}</span>
            <button 
              onClick={loadData}
              className="text-xs text-blue-400 hover:text-blue-300"
              disabled={isLoading}
            >
              {isLoading ? "Loading..." : "Refresh"}
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200">
            <div className="flex items-center gap-2 mb-1">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-semibold">Error</span>
            </div>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Section 1: Add Featured Artist */}
        <div className="relative overflow-hidden rounded-[6px] border border-white/10 bg-[#1a1414]/45 shadow-[0_20px_50px_rgba(0,0,0,0.35)] mb-6">
          <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent" />
          <div className="relative px-5 py-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-medium text-white">Add Featured Artist</h2>
                <p className="text-sm text-white/60">Select existing artist or create new one</p>
              </div>
            </div>
            
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setAddMode("existing")}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  addMode === "existing"
                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                    : "text-white/60 hover:text-white"
                }`}
              >
                Select Existing
              </button>
            <button
              onClick={() => setAddMode("manual")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                addMode === "manual"
                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                  : "text-white/60 hover:text-white"
              }`}
            >
              Create New
            </button>
          </div>

          {isLoading ? (
            <div className="flex items-center gap-3 py-4">
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              <span className="text-white/60">Loading artists...</span>
            </div>
          ) : addMode === "existing" ? (
            // Existing Artist Mode
            artists.length === 0 ? (
              <div className="py-4 px-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <div className="flex items-center gap-2 text-yellow-400">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span className="font-medium">No artists found in database</span>
                </div>
                <p className="text-sm text-white/50 mt-1 ml-7">Please add artists first before featuring them.</p>
              </div>
            ) : availableArtists.length === 0 ? (
              <div className="py-4 px-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <div className="flex items-center gap-2 text-blue-400">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-medium">All artists are already featured</span>
                </div>
                <p className="text-sm text-white/50 mt-1 ml-7">Remove some featured artists below or create a new one manually.</p>
              </div>
            ) : (
              <div className="flex gap-4 items-end">
                <div className="flex-1">
                  <label className="block text-sm text-white/60 mb-2">Select Artist</label>
                  <select
                    value={selectedArtistId}
                    onChange={(e) => setSelectedArtistId(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                    disabled={isAdding}
                  >
                    <option value="">Select an artist...</option>
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
                  className="px-6 py-3 bg-gradient-to-r from-amber-500 to-pink-500 text-white font-medium rounded-lg 
                           hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all
                           flex items-center gap-2"
                >
                  {isAdding ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Adding...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add Featured
                    </>
                  )}
                </button>
              </div>
            )
          ) : (
            // Manual Creation Mode
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-white/60 mb-2">Artist Name</label>
                <input
                  type="text"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  placeholder="Enter artist name..."
                  className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                  disabled={isAdding}
                />
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-2">Avatar Image</label>
                <ImageUpload
                  onImageUploaded={setManualAvatar}
                  currentImage={manualAvatar}
                />
              </div>
              
              <button
                onClick={handleAddFeatured}
                disabled={!manualName.trim() || !manualAvatar.trim() || isAdding}
                className="w-full px-6 py-3 bg-gradient-to-r from-amber-500 to-pink-500 text-white font-medium rounded-lg 
                         hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all
                         flex items-center justify-center gap-2"
              >
                {isAdding ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Creating...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Create Featured Artist
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

        {/* Section 2: Featured Artists List */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-pink-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-pink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Featured Artists</h2>
                <p className="text-sm text-white/50">{featured.length} artist{featured.length !== 1 ? 's' : ''} featured</p>
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-8 h-8 border-3 border-white/30 border-t-amber-500 rounded-full animate-spin mb-3"></div>
              <span className="text-white/60">Loading featured artists...</span>
            </div>
          ) : featured.length === 0 ? (
            <div className="text-center py-12 px-4">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-700/50 flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-white mb-2">No featured artists yet</h3>
              <p className="text-white/50 max-w-md mx-auto">
                Add artists from the dropdown above to feature them on the fan app home screen.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {featured.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-4 p-4 bg-gray-900/50 rounded-xl border border-gray-700 hover:border-gray-600 transition-colors"
                >
                  {/* Avatar */}
                  <div className="w-14 h-14 rounded-full bg-gray-700 overflow-hidden flex-shrink-0">
                    {item.avatar ? (
                      <img
                        src={item.avatar}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-500">
                        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-white truncate">{item.name}</h3>
                    <p className="text-sm text-white/50">
                      Added {new Date(item.createdAt).toLocaleDateString()}
                    </p>
                  </div>

                  {/* Status Toggle */}
                  <button
                    onClick={() => handleToggleActive(item.id, item.isActive)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      item.isActive
                        ? "bg-green-500/20 text-green-400 border border-green-500/30"
                        : "bg-gray-700 text-white/60 border border-gray-600"
                    }`}
                  >
                    {item.isActive ? "Active" : "Inactive"}
                  </button>

                  {/* Remove Button */}
                  <button
                    onClick={() => handleRemove(item.id)}
                    className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    title="Remove from featured"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <h3 className="text-sm font-medium text-blue-400 mb-2 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            How it works
          </h3>
          <ul className="text-sm text-white/60 space-y-1 list-disc list-inside">
            <li>Featured artists appear in the "Featured Artists" section on the fan app home screen</li>
            <li>You can select an existing artist OR create a new featured artist manually</li>
            <li>Manual featured artists don't need to be registered users - just provide a name and image URL</li>
            <li>Inactive artists remain in the database but won't display to fans</li>
            <li>Maximum 10 featured artists will be shown to users</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
  );
}