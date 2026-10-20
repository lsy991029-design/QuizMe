import { createContext, useContext, useEffect, type PropsWithChildren } from "react";
import { MobileDeviceProvider, useMobileDevice } from "./Device";
import { KeyboardDock, KeyboardProvider, useKeyboard } from "./Keyboard";
import { PhoneFrame } from "./PhoneFrame";
import { HomeIndicator, StatusBar } from "./components";

export type MobileRuntimeMode = "device" | "fullscreen";

const MobileRuntimeModeContext = createContext<MobileRuntimeMode>("device");

export function useMobileRuntimeMode() {
  return useContext(MobileRuntimeModeContext);
}

export function MobileRuntime({
  children,
  mode = "device",
}: PropsWithChildren<{ mode?: MobileRuntimeMode }>) {
  return (
    <MobileRuntimeModeContext.Provider value={mode}>
      <MobileDeviceProvider>
        <PhoneFrame mode={mode}>
          <KeyboardProvider>
            <KeyboardPreview />
            {mode === "device" ? <StatusBar /> : null}
            <MobileAppViewport>{children}</MobileAppViewport>
            {mode === "device" ? <HomeIndicator /> : null}
            {mode === "device" ? <KeyboardDock /> : null}
          </KeyboardProvider>
        </PhoneFrame>
      </MobileDeviceProvider>
    </MobileRuntimeModeContext.Provider>
  );
}

function MobileAppViewport({ children }: PropsWithChildren) {
  const { device } = useMobileDevice();
  const keyboard = useKeyboard();

  return (
    <div
      className="mobile-app-viewport"
      data-keyboard-visible={keyboard.visible ? "true" : "false"}
      data-platform={device.platform}
      data-testid="mobile-app-viewport"
    >
      {children}
    </div>
  );
}

function KeyboardPreview() {
  const keyboard = useKeyboard();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("keyboard") === "1") {
      keyboard.show();
    }
  }, [keyboard]);

  return null;
}
