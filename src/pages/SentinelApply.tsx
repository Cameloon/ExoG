import { Navigate } from "react-router-dom";
import { SentinelWizard } from "@/components/sections/SentinelWizard";
import { useSentinelApplication } from "@/hooks/useSentinelApplication";
import { useAuth } from "@/hooks/useAuth";

const SentinelApply = () => {
  const { isAdmin, isBehoerde, isEinrichtung, isSentinel } = useAuth();
  const { status, checking, isApproved } = useSentinelApplication();

  if (checking) return null;
  // Only a non-established user with no existing application may apply.
  // Admins, behörde, einrichtung and approved sentinels never see the wizard.
  if (isAdmin || isBehoerde || isEinrichtung || isSentinel) {
    return <Navigate to="/dashboard" replace />;
  }
  if (isApproved || status === "pending" || status === "under_review") {
    return <Navigate to="/dashboard" replace />;
  }

  return <SentinelWizard variant="fullscreen" />;
};

export default SentinelApply;
