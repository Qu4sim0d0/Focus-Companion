import { init, use } from "echarts/core";
import { LineChart } from "echarts/charts";
import {
  DataZoomComponent,
  GridComponent,
  MarkLineComponent,
  TooltipComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

use([
  LineChart,
  DataZoomComponent,
  GridComponent,
  MarkLineComponent,
  TooltipComponent,
  CanvasRenderer,
]);

export { init };
