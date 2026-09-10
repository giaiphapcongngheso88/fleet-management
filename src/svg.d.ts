// svg.d.ts
// @svgr/webpack (configured in next.config.ts) makes the default export of an
// imported .svg file the React component itself, not the file URL.
declare module "*.svg" {
  import * as React from "react";
  const ReactComponent: React.FunctionComponent<
    React.SVGProps<SVGSVGElement> & { title?: string }
  >;
  export default ReactComponent;
}
