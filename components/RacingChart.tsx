
import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { ProcessedDataPoint, AnimationConfig } from '../types';

interface RacingChartProps {
  data: ProcessedDataPoint[];
  config: AnimationConfig;
  isPaused: boolean;
  onFinished: () => void;
}

const RacingChart: React.FC<RacingChartProps> = ({ data, config, isPaused, onFinished }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [currentDateIndex, setCurrentDateIndex] = useState(0);
  const timerRef = useRef<number | null>(null);

  const dates = useMemo(() => Array.from(new Set(data.map(d => d.date))).sort(), [data]);
  
  // Marges optimisées pour les longs noms de magasins
  const margin = { top: 100, right: 120, bottom: 40, left: 220 };
  const width = 1000;
  const height = 650;

  const colorScale = useMemo(() => {
    const names = Array.from(new Set(data.map(d => d.name)));
    const distinctPalette = [
      '#FF003C', '#00FF42', '#0066FF', '#FFFF00', '#FF00FF', '#00FFFF', 
      '#FF8000', '#9900FF', '#FF007F', '#00FF95', '#FFCC00', '#ADFF2F', 
      '#00BFFF', '#FF1493', '#7FFF00', '#FF4500', '#1E90FF', '#FFD700', 
      '#8A2BE2', '#00FA9A', '#FF6347', '#40E0D0', '#EE82EE', '#F4A460',
      '#7B68EE', '#32CD32', '#FF69B4', '#00CED1', '#FFDAB9', '#CD5C5C',
      '#4B0082', '#00FF00', '#DA70D6', '#B22222', '#008080', '#D2691E',
      '#FF00FF', '#191970', '#8FBC8F', '#FF1493'
    ];
    
    return d3.scaleOrdinal<string>()
      .domain(names)
      .range(distinctPalette);
  }, [data]);

  const frameDuration = useMemo(() => (config.duration * 1000) / dates.length, [config.duration, dates.length]);

  useEffect(() => {
    if (isPaused) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = window.setInterval(() => {
      setCurrentDateIndex(prev => {
        if (prev >= dates.length - 1) {
          return prev;
        }
        return prev + 1;
      });
    }, frameDuration);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [dates.length, frameDuration, isPaused]);

  useEffect(() => {
    if (dates.length > 0 && currentDateIndex >= dates.length - 1) {
      if (timerRef.current) clearInterval(timerRef.current);
      const timeout = setTimeout(() => {
        if (typeof onFinished === 'function') {
          onFinished();
        }
      }, frameDuration);
      return () => clearTimeout(timeout);
    }
  }, [currentDateIndex, dates.length, frameDuration, onFinished]);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    const date = dates[currentDateIndex];
    const currentData = data
      .filter(d => d.date === date)
      .sort((a, b) => b.cumulativeValue - a.cumulativeValue)
      .slice(0, config.entitiesToShow)
      .map((d, i) => ({ ...d, rank: i }));

    const x = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.cumulativeValue) || 100])
      .range([margin.left, width - margin.right]);

    const y = d3.scaleBand()
      .domain(d3.range(config.entitiesToShow).map(String))
      .range([margin.top, height - margin.bottom])
      .padding(0.15);

    const transition = d3.transition()
      .duration(frameDuration)
      .ease(d3.easeLinear);

    // Initialisation des calques (Z-index : Watermark -> Chart -> UI)
    if (svg.select('.watermark-layer').empty()) svg.append('g').attr('class', 'watermark-layer');
    if (svg.select('.chart-layer').empty()) svg.append('g').attr('class', 'chart-layer');
    if (svg.select('.ui-layer').empty()) svg.append('g').attr('class', 'ui-layer');

    const watermarkLayer = svg.select('.watermark-layer');
    const chartLayer = svg.select('.chart-layer');
    const uiLayer = svg.select('.ui-layer');

    if (svg.select('defs').empty()) {
      const defs = svg.append('defs');
      const filter = defs.append('filter')
        .attr('id', 'neon-glow')
        .attr('x', '-20%')
        .attr('y', '-20%')
        .attr('width', '140%')
        .attr('height', '140%');
      
      filter.append('feGaussianBlur')
        .attr('stdDeviation', '2.5')
        .attr('result', 'blur');
      
      filter.append('feMerge').selectAll('feMergeNode')
        .data(['blur', 'SourceGraphic'])
        .enter().append('feMergeNode')
        .attr('in', d => d);
    }

    // 1. DATE EN FILIGRANE (BLANC OPACITÉ 0.15)
    watermarkLayer.selectAll('.date-label').remove();
    watermarkLayer.append('text')
      .attr('class', 'date-label font-black italic')
      .attr('x', width / 2 + margin.left / 4)
      .attr('y', height / 2 + margin.top)
      .attr('text-anchor', 'middle')
      .attr('fill', '#FFFFFF')
      .attr('opacity', 0.15)
      .style('font-size', '12rem')
      .style('pointer-events', 'none')
      .text(date);

    // 2. AXE Y (LIGNE VERTICALE BLANCHE)
    chartLayer.selectAll('.y-axis-line').remove();
    chartLayer.append('line')
      .attr('class', 'y-axis-line')
      .attr('x1', margin.left)
      .attr('x2', margin.left)
      .attr('y1', margin.top)
      .attr('y2', height - margin.bottom)
      .attr('stroke', '#FFFFFF')
      .attr('stroke-width', 2)
      .attr('opacity', 0.4);

    // BARRES
    const bars = chartLayer.selectAll<SVGRectElement, any>('.bar')
      .data(currentData, d => d.name);

    bars.enter()
      .append('rect')
      .attr('class', 'bar')
      .attr('x', margin.left)
      .attr('y', d => y(String(config.entitiesToShow)) || height)
      .attr('width', 0)
      .attr('height', y.bandwidth())
      .attr('fill', d => colorScale(d.name))
      .attr('filter', 'url(#neon-glow)')
      .merge(bars)
      .transition(transition)
      .attr('y', (d, i) => y(String(i))!)
      .attr('width', d => Math.max(0, x(d.cumulativeValue) - margin.left))
      .attr('fill', d => colorScale(d.name));

    bars.exit().remove();

    // 3. LABELS DES ENTITÉS (BLANC PUR)
    const labels = chartLayer.selectAll<SVGTextElement, any>('.label')
      .data(currentData, d => d.name);

    labels.enter()
      .append('text')
      .attr('class', 'label font-bold')
      .attr('text-anchor', 'end')
      .attr('fill', '#FFFFFF')
      .attr('x', margin.left - 20)
      .attr('y', height)
      .style('font-size', '14px')
      .text(d => d.name)
      .merge(labels)
      .transition(transition)
      .attr('y', (d, i) => y(String(i))! + y.bandwidth() / 2 + 5)
      .attr('fill', '#FFFFFF')
      .text(d => d.name);

    labels.exit().remove();

    // 4. VALEURS DYNAMIQUES (BLANC PUR)
    const values = chartLayer.selectAll<SVGTextElement, any>('.value')
      .data(currentData, d => d.name);

    values.enter()
      .append('text')
      .attr('class', 'value text-xs font-mono font-bold')
      .attr('fill', '#FFFFFF')
      .attr('x', d => x(d.cumulativeValue) + 10)
      .attr('y', height)
      .merge(values)
      .transition(transition)
      .attr('x', d => x(d.cumulativeValue) + 10)
      .attr('y', (d, i) => y(String(i))! + y.bandwidth() / 2 + 5)
      .attr('fill', '#FFFFFF')
      .tween('text', function(d) {
         const currentText = this.textContent || "0";
         const current = parseFloat(currentText.replace(/[^0-9.-]+/g, "")) || 0;
         const i = d3.interpolateNumber(current, d.cumulativeValue);
         return function(t) {
           this.textContent = Math.round(i(t)).toLocaleString();
         };
      });

    values.exit().remove();

    // 5. TITRES ET SOUS-TITRES (BLANC PUR)
    uiLayer.selectAll('.chart-title').remove();
    uiLayer.append('text')
      .attr('class', 'chart-title font-black italic uppercase tracking-tighter')
      .attr('x', margin.left)
      .attr('y', 55)
      .attr('fill', '#FFFFFF')
      .style('font-size', '2.5rem')
      .text(config.title);

    uiLayer.selectAll('.chart-subtitle').remove();
    uiLayer.append('text')
      .attr('class', 'chart-subtitle font-bold uppercase tracking-[0.2em]')
      .attr('x', margin.left)
      .attr('y', 80)
      .attr('fill', '#FFFFFF')
      .attr('opacity', 0.6)
      .style('font-size', '0.7rem')
      .text("CÉLINA DATA ENGINE • ANALYSE DE PERFORMANCE");

  }, [currentDateIndex, data, config, frameDuration, colorScale]);

  return (
    <div className="bg-slate-900/95 p-6 rounded-[2.5rem] border border-slate-700 shadow-2xl overflow-hidden relative">
      <svg 
        id="racing-chart-svg" 
        ref={svgRef} 
        viewBox={`0 0 ${width} ${height}`} 
        className="w-full h-auto drop-shadow-2xl" 
      />
      <div className="mt-8 flex items-center gap-8 px-6 pb-2">
         <div className="flex-1 bg-slate-800 h-2 rounded-full overflow-hidden shadow-inner">
            <div className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 h-full shadow-[0_0_15px_rgba(99,102,241,0.5)] transition-all duration-300 ease-linear" style={{ width: `${(currentDateIndex / (dates.length - 1)) * 100}%` }} />
         </div>
         <div className="flex flex-col items-end min-w-[160px]">
            <span className="text-[9px] text-slate-500 uppercase tracking-widest font-black italic mb-1">Timeline CÉLINA</span>
            <span className="text-xl text-indigo-400 font-mono font-black tracking-tighter">{dates[currentDateIndex]}</span>
         </div>
      </div>
    </div>
  );
};

export default RacingChart;
