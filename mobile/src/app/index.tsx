import { Redirect } from "expo-router";
import { useAuth } from "@/auth/AuthContext";

/**
 * The root layout only renders this Stack once `status` has left "loading" (see _layout.tsx),
 * so by the time this mounts the redirect target is always known — no loading state needed here.
 */
export default function Index() {
  const { status } = useAuth();
  return <Redirect href={status === "signedIn" ? "/closet" : "/sign-in"} />;
}
