// ChartCanvas.tsx
import React, { useRef, useState, useEffect } from 'react';
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
  vcData: number[];
  vrData: number[];
  iData: number[];
  ecData: number[];
  erData: number[];
  isPaused: boolean;
  isCharging: boolean;
  onPauseSim: () => void;
  resistance: number;
  capacitance: number;
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

const tauMilestonesPlugin = {
  id: 'tauMilestones',
  afterDraw: (chart: ChartJS) => {
    const pluginOptions = (chart.options.plugins as Record<string, { tau?: number, isCharging?: boolean } | undefined>)?.tauMilestones;
    if (!pluginOptions || !pluginOptions.tau) return;

    const { tau, isCharging } = pluginOptions;
    const ctx = chart.ctx;
    const xAxis = chart.scales.x;
    const chartArea: ChartArea = chart.chartArea;

    const milestones = [
      { t: tau, label: '1τ', pctCharge: '63.2%', pctDischarge: '36.8%' },
      { t: 5 * tau, label: '5τ', pctCharge: '99.3%', pctDischarge: '0.7%' }
    ];

    ctx.save();
    milestones.forEach((m) => {
      const xPixel = xAxis.getPixelForValue(m.t);
      if (xPixel >= chartArea.left && xPixel <= chartArea.right) {
        // Draw vertical dashed line
        ctx.beginPath();
        ctx.setLineDash([4, 4]);
        ctx.moveTo(xPixel, chartArea.top);
        ctx.lineTo(xPixel, chartArea.bottom);
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)'; // Subtle white dashed line
        ctx.stroke();

        // Draw label text
        ctx.fillStyle = '#94a3b8'; // Slate 400
        ctx.font = 'bold 9px JetBrains Mono';
        const percentText = isCharging ? m.pctCharge : m.pctDischarge;
        const fullLabel = `${m.label} (${percentText})`;
        
        ctx.fillText(fullLabel, xPixel + 5, chartArea.top + 15);
      }
    });
    ctx.restore();
  }
};

ChartJS.register(verticalCursorPlugin, tauMilestonesPlugin);

export const ChartCanvas: React.FC<ChartCanvasProps> = ({
  times,
  vcData,
  vrData,
  iData,
  ecData,
  erData,
  isPaused,
  isCharging,
  onPauseSim,
  resistance,
  capacitance,
}) => {
  const chartRef = useRef<ChartJS<'line'> | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Clear cursor if simulation is playing
  useEffect(() => {
    if (!isPaused) {
      setActiveIndex(null);
    }
  }, [isPaused]);

  // Map data to chart.js structure
  const chartData = {
    datasets: [
      {
        label: 'Vc (Capacitor)',
        data: times.map((t, idx) => ({ x: t, y: vcData[idx] })),
        borderColor: '#06b6d4', // Cyan
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 0,
        yAxisID: 'y',
      },
      {
        label: 'Vr (Resistor)',
        data: times.map((t, idx) => ({ x: t, y: vrData[idx] })),
        borderColor: '#10b981', // Emerald Green (Dashed)
        borderWidth: 2,
        borderDash: [6, 4],
        pointRadius: 0,
        pointHoverRadius: 0,
        yAxisID: 'y',
      },
      {
        label: 'I (Current)',
        data: times.map((t, idx) => ({ x: t, y: iData[idx] })),
        borderColor: '#10b981', // Emerald Green
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 0,
        yAxisID: 'y1',
      },
    ],
  };

  // Compute dynamic scale for Current axis matching python's logic:
  // I_max = V0 / R (in mA), with 20% margin, floor of 1.0mA
  const v0 = 12.0;
  const currentMaxMA = (v0 / resistance) * 1000 * 1.2;
  const currentLimitMA = Math.max(currentMaxMA, 1.0);

  // Set X-axis window limits: span exactly from 0 to 10 * tau
  const tau = resistance * capacitance;
  const xMin = 0;
  const xMax = Math.max(10.0 * tau, 0.01);

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
          color: 'rgba(255, 255, 255, 0.05)',
        },
        ticks: {
          color: '#94a3b8',
          font: {
            family: 'JetBrains Mono',
            size: 10,
          },
        },
        title: {
          display: true,
          text: 'Time (seconds)',
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
        min: isCharging ? 0 : -13.0,
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
      tauMilestones: {
        tau: tau,
        isCharging: isCharging,
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

    // Clamp value to range of times array
    if (xValue < times[0] || xValue > times[times.length - 1]) {
      return;
    }

    // Binary search or linear search for nearest time index
    let nearestIdx = 0;
    let minDiff = Infinity;
    for (let i = 0; i < times.length; i++) {
      const diff = Math.abs(times[i] - xValue);
      if (diff < minDiff) {
        minDiff = diff;
        nearestIdx = i;
      }
    }

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

  // Render floating tooltip data box
  const renderTooltip = () => {
    if (activeIndex === null || activeIndex >= times.length) return null;

    return (
      <div className="cursor-tooltip">
        <div className="tooltip-col">
          <span className="tooltip-label">Time:</span>
          <span className="tooltip-value time">{times[activeIndex].toFixed(2)}s</span>
        </div>
        <div className="tooltip-col">
          <span className="tooltip-label">Vc:</span>
          <span className="tooltip-value vc">{vcData[activeIndex].toFixed(2)}V</span>
        </div>
        <div className="tooltip-col">
          <span className="tooltip-label">Vr:</span>
          <span className="tooltip-value current" style={{ color: 'var(--accent-green)' }}>{vrData[activeIndex].toFixed(2)}V</span>
        </div>
        <div className="tooltip-col">
          <span className="tooltip-label">Current:</span>
          <span className="tooltip-value current">{iData[activeIndex].toFixed(2)}mA</span>
        </div>
        <div className="tooltip-col">
          <span className="tooltip-label">E_cap:</span>
          <span className="tooltip-value ec">{ecData[activeIndex].toFixed(2)}mJ</span>
        </div>
        <div className="tooltip-col">
          <span className="tooltip-label">E_res:</span>
          <span className="tooltip-value er">{erData[activeIndex].toFixed(2)}mJ</span>
        </div>
      </div>
    );
  };

  return (
    <div className="chart-wrapper">
      {renderTooltip()}
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
