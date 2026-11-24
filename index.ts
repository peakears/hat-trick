// App entry: Expo Router as usual, plus the live score service, registered at startup before any screen renders.
// Android can start the JS for the service or a notification event with no screen open, so this cannot wait for
// a component to mount.
import "expo-router/entry";
import { registerLiveTracking } from "./src/ui/notifications/live-tracker-run";

registerLiveTracking();
