export const DEFAULT_PROFILE_IMAGE_URL = "/images/default_pfp.jpg";

function isGoogleProviderImage(value: string) {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return hostname === "googleusercontent.com" || hostname.endsWith(".googleusercontent.com");
  } catch {
    return false;
  }
}

export function profileImageUrl(image?: string | null) {
  const value = image?.trim();

  // Google supplies an initial-based placeholder even when the account owner has
  // not chosen an avatar. BeeSmart uses its lily until the user uploads one here.
  return value && !isGoogleProviderImage(value) ? value : DEFAULT_PROFILE_IMAGE_URL;
}
