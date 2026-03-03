import { useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { loadAccountSettings, saveAccountSettings } from "../firebase/accountSettings";
import { fetchProfileUsername, changeUsername } from "../firebase/usernameAuth";

export function useAccountCloudSync({
  config,
  replaceConfig,
  viewMode,
  setViewMode,
  boardScale,
  setBoardScale,
  warnDeleteSingleAction,
  setWarnDeleteSingleAction,
  warnDeleteSubtree,
  setWarnDeleteSubtree,
}) {
  const { user, authLoading } = useAuth();
  const [cloudLoading, setCloudLoading] = useState(false);
  const [profile, setProfile] = useState({ username: "", profileText: "" });
  const didLoadForUser = useRef(false);

  // Pull from cloud ONCE per login session
  useEffect(() => {
    if (authLoading) return;

    async function run() {
      if (!user) {
        didLoadForUser.current = false;
        setProfile({ username: "", profileText: "" });
        return;
      }
      if (didLoadForUser.current) return;

      setCloudLoading(true);
      try {
        const remote = await loadAccountSettings(user.uid);

        // If nothing exists yet: seed cloud with current local settings
        if (!remote) {
          // Still fetch username from users/{uid} in case it was set during registration
          const canonicalUsername = await fetchProfileUsername(user.uid);
          setProfile({
            username: canonicalUsername || "",
            profileText: "",
          });
          await saveAccountSettings(user.uid, {
            config,
            prefs: {
              viewMode,
              boardScale,
              warnDeleteSingleAction,
              warnDeleteSubtree,
            },
            profile: { profileText: "" },
          });
          didLoadForUser.current = true;
          return;
        }

        // Apply remote settings locally
        if (remote.config) replaceConfig(remote.config);

        if (remote.prefs) {
          if (remote.prefs.viewMode) setViewMode(remote.prefs.viewMode);
          if (typeof remote.prefs.boardScale === "number")
            setBoardScale(remote.prefs.boardScale);
          if (typeof remote.prefs.warnDeleteSingleAction === "boolean")
            setWarnDeleteSingleAction(remote.prefs.warnDeleteSingleAction);
          if (typeof remote.prefs.warnDeleteSubtree === "boolean")
            setWarnDeleteSubtree(remote.prefs.warnDeleteSubtree);
        }

        // Load profile data - username comes from users/{uid}.username (canonical source)
        const canonicalUsername = await fetchProfileUsername(user.uid);
        setProfile({
          username: canonicalUsername || "",
          profileText: remote.profile?.profileText || "",
        });

        didLoadForUser.current = true;
      } finally {
        setCloudLoading(false);
      }
    }

    run().catch((e) => {
      console.error("Cloud sync failed:", e);
      setCloudLoading(false);
    });

    // IMPORTANT: don’t depend on config/prefs here; we want one-time load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  // Push current local settings to cloud (call on Save)
  async function saveNow(nextConfig, nextPrefs, nextProfile) {
    if (!user) return;
    
    // Handle username change separately via usernames collection
    if (nextProfile?.username !== undefined) {
      const oldUsername = profile.username;
      const newUsername = nextProfile.username.trim().toLowerCase();
      const oldNormalized = (oldUsername || "").trim().toLowerCase();
      
      if (newUsername && newUsername !== oldNormalized) {
        try {
          await changeUsername({
            uid: user.uid,
            email: user.email,
            oldUsername: oldNormalized,
            newUsername,
          });
          // Update local profile state with new username
          setProfile((prev) => ({ ...prev, username: newUsername }));
        } catch (err) {
          console.error("Failed to change username:", err);
          // Re-throw to let caller handle the error
          throw err;
        }
      }
    }
    
    // Save other profile data (profileText) and settings
    const payload = {};
    if (nextConfig) payload.config = nextConfig;
    if (nextPrefs) payload.prefs = nextPrefs;
    if (nextProfile?.profileText !== undefined) {
      payload.profile = { profileText: nextProfile.profileText };
      setProfile((prev) => ({ ...prev, profileText: nextProfile.profileText }));
    }
    if (Object.keys(payload).length > 0) {
      await saveAccountSettings(user.uid, payload);
    }
  }

  return { cloudLoading, canCloudSave: !!user, saveNow, profile };
}
