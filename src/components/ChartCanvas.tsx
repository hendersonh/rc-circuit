// ChartCanvas.tsx
// lang=en
import React, { useRef, useState } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  ChartArea,
  ChartOptions,
} from 'chart.js';

ChartJS.register(LinearScale, PointElement, LineElement, Tooltip, Legend);

interface ChartCanvasProps {
  times: number[];
  vcData: (number | null)[];
  vrData: (number | null)[];
  iData: (number | null)[];
  vinData: (number | null)[];
  isPaused: boolean;
  onPauseSim: () => void;
  resistance: number;
  activeIndex: number | null;
  setActiveIndex: (index: number | null) => void;
  frequency: number;
}

// Custom plugin to draw vertical cursor line on active index
const verticalCursorPlugin = {
  id: 'verticalCursor',
  afterDraw: (chart: ChartJS) => {
    const activeIndex = (chart.options.plugins as Record<string, { activeIndex?: number | null } | undefined>)?.verticalCursor?.activeIndex;
    if (activeIndex !== undefined && activeIndex !== null && activeIndex >= 0) {
      const ctx = chart.ctx;
      const xAxis = chart.scales.x;
      const activeX = xAxis.getPixelForValue((chart.data.datasets[0].data[activeIndex] as { x: number }).x);
      
      const chartArea: ChartArea = chart.chartArea;

      ctx.save();
      ctx.beginPath();
      ctx.setLineDash([6, 4]);
      ctx.moveTo(activeX, chartArea.top);
      ctx.lineTo(activeX, chartArea.bottom);
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#f59e0b'; // Amber accent
      ctx.stroke();
      ctx.restore();
    }
  }
};

ChartJS.register(verticalCursorPlugin);

export const ChartCanvas: React.FC<ChartCanvasProps> = ({
  times,
  vcData,
  vrData,
  iData,
  vinData,
  isPaused,
  onPauseSim,
  resistance,
  activeIndex,
  setActiveIndex,
  frequency,
}) => {
  const chartRef = useRef<ChartJS<'line'> | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Map data to chart.js structure — fixed 300-slot oscilloscope buffers
  // null values create natural gaps (phosphor sweep gap) via spanGaps: false
  const chartData = {
    datasets: [
      {
        label: 'Vin (Source)',
        data: times.map((t, idx) => ({ x: t, y: vinData[idx] })),
        borderColor: '#f59e0b', // Amber
        borderWidth: 1.5,
        pointRadius: 0,
        pointHoverRadius: 0,
        spanGaps: false,
        yAxisID: 'y',
      },
      {
        label: 'Vc (Capacitor)',
        data: times.map((t, idx) => ({ x: t, y: vcData[idx] })),
        borderColor: '#06b6d4', // Cyan
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 0,
        spanGaps: false,
        yAxisID: 'y',
      },
      {
        label: 'Vr (Resistor)',
        data: times.map((t, idx) => ({ x: t, y: vrData[idx] })),
        borderColor: '#10b981', // Emerald (dashed)
        borderWidth: 2,
        borderDash: [6, 4],
        pointRadius: 0,
        pointHoverRadius: 0,
        spanGaps: false,
        yAxisID: 'y',
      },
      {
        label: 'I (Current)',
        data: times.map((t, idx) => ({ x: t, y: iData[idx] })),
        borderColor: '#10b981', // Emerald
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 0,
        spanGaps: false,
        yAxisID: 'y1',
      },
    ],
  };

  // Compute dynamic scale for Current axis matching python's logic:
  // I_max = V0 / R (in mA), with 20% margin, floor of 1.0mA
  const v0 = 12.0;
  const currentMaxMA = (v0 / resistance) * 1000 * 1.2;
  const currentLimitMA = Math.max(currentMaxMA, 1.0);

  // Fixed oscilloscope X-axis: always show exactly 2 cycles [0, 2T]
  const period = 1.0 / frequency;
  const xMin = 0;
  const xMax = 2.0 * period;
  // Dynamic X-axis tick step — aim for ~8 divisions across the 2-cycle window
  const xTickStep = (2.0 * period) / 8;

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    layout: {
      padding: {
        top: 15,
        bottom: 0,
      },
    },
    scales: {
      x: {
        type: 'linear',
        position: 'bottom',
        min: xMin,
        max: xMax,
        grid: {
          color: 'rgba(255, 255, 255, 0.06)',
        },
        ticks: {
          color: '#94a3b8',
          font: {
            family: 'JetBrains Mono',
            size: 10,
          },
          stepSize: xTickStep,
          callback: (val: number | string) => {
            const v = typeof val === 'number' ? val : parseFloat(val);
            return v.toFixed(period < 0.1 ? 3 : period < 1 ? 2 : 2) + 's';
          },
        },
        title: {
          display: true,
          text: `Time  ·  2 cycles  (T = ${(1000 / frequency).toFixed(1)} ms)`,
          color: '#94a3b8',
          font: {
            size: 11,
            weight: 'bold',
          },
        },
      },
      y: {
        type: 'linear',
        position: 'left',
        min: -13.0,
        max: 13.0,
        grid: {
          color: 'rgba(255, 255, 255, 0.05)',
        },
        ticks: {
          color: '#06b6d4',
          font: {
            family: 'JetBrains Mono',
            size: 10,
          },
        },
        title: {
          display: true,
          text: 'Vc (Volts)',
          color: '#06b6d4',
          font: {
            size: 11,
            weight: 'bold',
          },
        },
      },
      y1: {
        type: 'linear',
        position: 'right',
        min: -currentLimitMA,
        max: currentLimitMA,
        grid: {
          drawOnChartArea: false, // only draw grid for left axis
        },
        ticks: {
          color: '#10b981',
          font: {
            family: 'JetBrains Mono',
            size: 10,
          },
        },
        title: {
          display: true,
          text: 'I (milliamperes)',
          color: '#10b981',
          font: {
            size: 11,
            weight: 'bold',
          },
        },
      },
    },
    plugins: {
      legend: {
        display: true,
        position: 'top',
        labels: {
          boxWidth: 15,
          color: '#f1f5f9',
          font: {
            family: 'Outfit',
            size: 12,
            weight: 'bold',
          },
        },
      },
      tooltip: {
        enabled: false, // Use our custom floating HTML tooltip
      },
      verticalCursor: {
        activeIndex: activeIndex,
      },
    },
  } as unknown as ChartOptions<'line'>;

  // Mouse/Pointer event handler to handle dragging cursor
  const handlePointerEvent = (clientX: number) => {
    const chart = chartRef.current;
    if (!chart || times.length === 0) return;

    // Pause simulation if active
    if (!isPaused) {
      onPauseSim();
    }

    const canvas = chart.canvas;
    const rect = canvas.getBoundingClientRect();
    const xInCanvas = clientX - rect.left;

    // Convert screen X pixel to chart scale value
    const xValue = chart.scales.x.getValueForPixel(xInCanvas);
    if (xValue === undefined) return;

    // Map xValue into 300-slot fixed index
    const sweepWindow = 2.0 / frequency;
    const clampedX = Math.max(0, Math.min(xValue, sweepWindow));
    const nearestIdx = Math.min(299, Math.floor((clampedX / sweepWindow) * 300));
    setActiveIndex(nearestIdx);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    handlePointerEvent(e.clientX);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isDragging) {
      handlePointerEvent(e.clientX);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  return (
    <div className="chart-wrapper">
      <Line
        ref={chartRef}
        data={chartData}
        options={chartOptions}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{ cursor: 'crosshair' }}
      />
    </div>
  );
};
export default ChartCanvas;
