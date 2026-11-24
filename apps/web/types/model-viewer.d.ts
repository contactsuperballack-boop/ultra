// <model-viewer> is a custom element (Google's web component). Declared so JSX accepts it.
import "react";
declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        src?: string;
        alt?: string;
        "camera-controls"?: boolean | "";
        "auto-rotate"?: boolean | "";
        "shadow-intensity"?: string;
        "interaction-prompt"?: string;
        loading?: string;
        reveal?: string;
      };
    }
  }
}
