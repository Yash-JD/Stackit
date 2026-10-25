import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, LogOut, UserRound } from "lucide-react";
import { useNavigate } from "react-router";
import { getProfile, updateProfile, type UserProfile } from "../api";
import { useAuth } from "../auth";

export function ProfilePage() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [name, setName] = useState("");
  const [profilePhoto, setProfilePhoto] = useState("");
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const loadProfile = async () => {
    setIsLoading(true);
    setError("");
    try {
      const result = await getProfile();
      setProfile(result);
      setName(result.name);
      setProfilePhoto(result.profilePhoto ?? "");
      setDescription(result.description);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load your profile.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadProfile();
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccessMessage("");
    setIsSaving(true);
    try {
      const updatedProfile = await updateProfile({
        name: name.trim(),
        profilePhoto: profilePhoto.trim(),
        description: description.trim(),
      });
      setProfile(updatedProfile);
      setName(updatedProfile.name);
      setProfilePhoto(updatedProfile.profilePhoto ?? "");
      setDescription(updatedProfile.description);
      window.dispatchEvent(new Event("stackit:profile-changed"));
      setSuccessMessage("Your profile has been updated.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save your profile.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/signin", { replace: true });
  };

  return (
    <main className="board-shell profile-page">
      <header className="profile-page-header">
        <button
          type="button"
          className="secondary-button profile-back-button"
          onClick={() => navigate("/")}
        >
          <ArrowLeft size={15} /> Back
        </button>
        <p className="eyebrow">ACCOUNT</p>
        <h1>Your profile</h1>
        <p>
          Manage your profile details. Your email address cannot be changed.
        </p>
      </header>

      {isLoading ? (
        <div className="board-state" role="status" aria-live="polite">
          Loading your profile…
        </div>
      ) : error && !profile ? (
        <div className="board-state board-state-error" role="alert">
          <p>{error}</p>
          <button
            type="button"
            className="secondary-button"
            onClick={() => void loadProfile()}
          >
            Try again
          </button>
        </div>
      ) : profile ? (
        <section className="profile-card">
          <div className="profile-card-heading">
            <div className="profile-preview">
              {profilePhoto ? (
                <img src={profilePhoto} alt="" />
              ) : (
                <UserRound size={28} />
              )}
            </div>
            <div>
              <h2>Profile details</h2>
              <p>These details are shown to your collaborators.</p>
            </div>
          </div>
          <form className="profile-form" onSubmit={handleSubmit}>
            <label>
              <span>Name</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                maxLength={120}
                autoComplete="name"
              />
            </label>
            <label>
              <span>Email address</span>
              <input type="email" value={profile.email} readOnly />
              <small>Email changes are not available.</small>
            </label>
            <label>
              <span>Profile photo URL</span>
              <input
                type="url"
                value={profilePhoto}
                onChange={(event) => setProfilePhoto(event.target.value)}
                placeholder="https://example.com/photo.jpg"
                maxLength={2048}
              />
            </label>
            <label>
              <span>Short description</span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={500}
                rows={4}
              />
              <small>{description.length}/500 characters</small>
            </label>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            {successMessage && (
              <p className="profile-success" role="status">
                {successMessage}
              </p>
            )}
            <div className="profile-form-actions">
              <button
                type="submit"
                className="primary-button"
                disabled={
                  isSaving ||
                  !name.trim() ||
                  !description.trim() ||
                  (profilePhoto.trim() !== "" &&
                    !isValidUrl(profilePhoto.trim()))
                }
              >
                {isSaving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </form>
          <section className="profile-logout-section">
            <div>
              <h3>Sign out</h3>
              <p>Sign out of Stackit on this device.</p>
            </div>
            <button
              type="button"
              className="profile-logout-button"
              onClick={handleLogout}
            >
              <LogOut size={15} /> Log out
            </button>
          </section>
        </section>
      ) : null}
    </main>
  );
}

function isValidUrl(value: string) {
  try {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}
