
import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { ProcessedDataPoint, AnimationConfig } from '../types';

interface LineChartProps {
  data: ProcessedDataPoint[];
  config: AnimationConfig;
  isPaused: boolean;
  onFinished: () => void;
}

const LineChart: React.FC<LineChartProps> = ({ data, config, isPaused, onFinished }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [currentDateIndex, setCurrentDateIndex] = useState(0);
  const timerRef = useRef<number | null>(null);

  // 1. CORRECTION LOGIQUE : Somme journalière RÉELLE (non-cumulative)
  const aggregatedData = useMemo(() => {
    const dates = Array.from(new Set(data.map(d => d.date))).sort();
    return dates.map(date => {
      // On somme 'value' (le gain du jour) et non 'cumulativeValue'
      const total = data
        .filter(d => d.date === date)
        .reduce((sum, item) => sum + item.value, 0);
      return { date, total };
    });
  }, [data]);

  const dates = useMemo(() => aggregatedData.map(d => d.date), [aggregatedData]);
  const margin = { top: 120, right: 100, bottom: 80, left: 160 }; // Marge gauche augmentée pour l'axe Y
  const width = 1000;
  const height = 650;

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
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
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
    const visibleData = aggregatedData.slice(0, currentDateIndex + 1);

    const x = d3.scalePoint()
      .domain(dates)
      .range([margin.left, width - margin.right]);

    const maxValue = d3.max(aggregatedData, d => d.total) || 100;
    const y = d3.scaleLinear()
      .domain([0, maxValue * 1.1]) // Marge de 10% en haut
      .range([height - margin.bottom, margin.top]);

    if (svg.select('defs').empty()) {
      const defs = svg.append('defs');
      
      // Filtre Néon Jaune Florissant
      const filter = defs.append('filter')
        .attr('id', 'line-glow')
        .attr('x', '-50%').attr('y', '-50%').attr('width', '200%').attr('height', '200%');
      filter.append('feGaussianBlur').attr('stdDeviation', '4').attr('result', 'blur');
      filter.append('feMerge').selectAll('feMergeNode')
        .data(['blur', 'SourceGraphic']).enter().append('feMergeNode').attr('in', d => d);

      // Filtre Pointe Lumineuse
      const pointFilter = defs.append('filter')
        .attr('id', 'point-glow')
        .attr('x', '-100%').attr('y', '-100%').attr('width', '300%').attr('height', '300%');
      pointFilter.append('feGaussianBlur').attr('stdDeviation', '8').attr('result', 'blur');
      pointFilter.append('feMerge').selectAll('feMergeNode')
        .data(['blur', 'SourceGraphic']).enter().append('feMergeNode').attr('in', d => d);
    }

    // Calques
    if (svg.select('.bg-layer').empty()) svg.append('g').attr('class', 'bg-layer');
    if (svg.select('.line-layer').empty()) svg.append('g').attr('class', 'line-layer');
    if (svg.select('.ui-layer').empty()) svg.append('g').attr('class', 'ui-layer');

    const bgLayer = svg.select('.bg-layer');
    const lineLayer = svg.select('.line-layer');
    const uiLayer = svg.select('.ui-layer');

    // 3. ÉCHELLE ET GRILLE SUR L'AXE Y
    bgLayer.selectAll('.y-axis-group').remove();
    const yAxisGroup = bgLayer.append('g').attr('class', 'y-axis-group');

    // Axe Y vertical
    yAxisGroup.append('line')
      .attr('x1', margin.left).attr('y1', margin.top)
      .attr('x2', margin.left).attr('y2', height - margin.bottom)
      .attr('stroke', '#FFFFFF').attr('stroke-width', 2).attr('opacity', 0.4);

    // Axe X horizontal (base)
    yAxisGroup.append('line')
      .attr('x1', margin.left).attr('y1', height - margin.bottom)
      .attr('x2', width - margin.right).attr('y2', height - margin.bottom)
      .attr('stroke', '#FFFFFF').attr('stroke-width', 2).attr('opacity', 0.4);

    // Paliers et Grilles horizontales
    const yTicks = y.ticks(5);
    yTicks.forEach(tick => {
      const yPos = y(tick);
      
      // Ligne de grille
      yAxisGroup.append('line')
        .attr('x1', margin.left)
        .attr('x2', width - margin.right)
        .attr('y1', yPos)
        .attr('y2', yPos)
        .attr('stroke', 'rgba(255, 255, 255, 0.15)')
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '5,5');

      // Libellé de l'axe Y (Blanc)
      yAxisGroup.append('text')
        .attr('x', margin.left - 15)
        .attr('y', yPos + 5)
        .attr('text-anchor', 'end')
        .attr('fill', '#FFFFFF')
        .style('font-size', '12px')
        .style('font-weight', 'bold')
        .style('font-family', 'monospace')
        .text(tick.toLocaleString());
    });

    // Dessin de la ligne (Jaune Florissant #FBFF00)
    const lineGenerator = d3.line<any>()
      .x(d => x(d.date)!)
      .y(d => y(d.total))
      .curve(d3.curveMonotoneX);

    lineLayer.selectAll('.main-line').remove();
    lineLayer.append('path')
      .attr('class', 'main-line')
      .datum(visibleData)
      .attr('fill', 'none')
      .attr('stroke', '#FBFF00')
      .attr('stroke-width', 5)
      .attr('stroke-linecap', 'round')
      .attr('filter', 'url(#line-glow)')
      .attr('d', lineGenerator);

    // 2. POINTE LUMINEUSE (NETTOYÉE : SANS TEXTE)
    const lastPoint = visibleData[visibleData.length - 1];
    lineLayer.selectAll('.tip-point').remove();
    lineLayer.selectAll('.tip-value').remove(); // On s'assure que les anciens textes sont supprimés
    
    if (lastPoint) {
      lineLayer.append('circle')
        .attr('class', 'tip-point')
        .attr('cx', x(lastPoint.date)!)
        .attr('cy', y(lastPoint.total))
        .attr('r', 8)
        .attr('fill', '#FFFFFF')
        .attr('filter', 'url(#point-glow)');
      
      lineLayer.append('circle')
        .attr('class', 'tip-point')
        .attr('cx', x(lastPoint.date)!)
        .attr('cy', y(lastPoint.total))
        .attr('r', 12)
        .attr('fill', 'none')
        .attr('stroke', '#FBFF00')
        .attr('stroke-width', 2)
        .attr('opacity', 0.8)
        .attr('filter', 'url(#point-glow)');
    }

    // Titre (Blanc)
    uiLayer.selectAll('.chart-title').remove();
    uiLayer.append('text')
      .attr('class', 'chart-title font-black italic uppercase tracking-tighter')
      .attr('x', margin.left)
      .attr('y', 60)
      .attr('fill', '#FFFFFF')
      .style('font-size', '2.5rem')
      .text(config.title);

    uiLayer.selectAll('.chart-subtitle').remove();
    uiLayer.append('text')
      .attr('class', 'chart-subtitle font-bold uppercase tracking-[0.2em]')
      .attr('x', margin.left)
      .attr('y', 85)
      .attr('fill', '#FFFFFF')
      .attr('opacity', 0.6)
      .style('font-size', '0.7rem')
      .text("CÉLINA DATA ENGINE • ÉVOLUTION JOURNALIÈRE ANALYTIQUE");

    // Filigrane Date (Arrière-plan)
    bgLayer.selectAll('.date-watermark').remove();
    bgLayer.append('text')
      .attr('class', 'date-watermark font-black italic')
      .attr('x', width / 2)
      .attr('y', height / 2 + 50)
      .attr('text-anchor', 'middle')
      .attr('fill', '#FFFFFF')
      .attr('opacity', 0.1)
      .style('font-size', '12rem')
      .style('pointer-events', 'none')
      .text(dates[currentDateIndex]);

  }, [currentDateIndex, aggregatedData, config, dates]);

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
            <div className="bg-gradient-to-r from-yellow-400 to-yellow-600 h-full shadow-[0_0_15px_rgba(251,255,0,0.5)] transition-all duration-300 ease-linear" style={{ width: `${(currentDateIndex / (dates.length - 1)) * 100}%` }} />
         </div>
         <div className="flex flex-col items-end min-w-[160px]">
            <span className="text-[9px] text-slate-500 uppercase tracking-widest font-black italic mb-1">Chronologie CÉLINA</span>
            <span className="text-xl text-yellow-400 font-mono font-black tracking-tighter">{dates[currentDateIndex]}</span>
         </div>
      </div>
    </div>
  );
};

export default LineChart;
