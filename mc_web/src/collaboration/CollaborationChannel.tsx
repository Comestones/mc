import { useCollaborationChannel } from './useCollaborationChannel';
import { PresenceOverlay } from './PresenceOverlay';
export default function CollaborationChannel() {
  useCollaborationChannel();
  return <PresenceOverlay />;
}
