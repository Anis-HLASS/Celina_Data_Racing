import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { ProcessedDataPoint, AnimationConfig } from '../types';

interface BubbleChartProps {
  data: ProcessedDataPoint[];
  config: AnimationConfig;
  isPaused: boolean;
  onFinished: () => void;
}

interface BubbleNode extends d3.SimulationNodeDatum {
  name: string;
  value: number;
  targetRadius: number;
}

const BubbleChart: React.FC<BubbleChartProps> = ({ data, config, isPaused, onFinished }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [currentDateIndex, setCurrentDateIndex] = useState(0);
  const timerRef = useRef<number | null>(null);
  const nodesRef = useRef<BubbleNode[]>([]);
  const simulationRef = useRef<d3.Simulation<BubbleNode, undefined> | null>(null);

  const dates = useMemo(() => Array.from(new Set(data.map(d => d.date))).sort(), [data]);
  const entityNames = useMemo(() => {
    const names = Array.from(new Set(data.map(d => d.name)));
    return names.sort();
  }, [data]);

  const width = 1000;
  const height = 650;
  const margin = { top: 120, right: 60, bottom: 60, left: 60 };

  const colorScale = useMemo(() => {
    const palette = [
      '#FF3D00', '#3D5AFE', '#00E676', '#FFEA00', '#D500F9', '#00E5FF',
      '#FF9100', '#F50057', '#C6FF00', '#1DE9B6', '#FF1744', '#651FFF'
    ];
    return d3.scaleOrdinal<string>().domain(entityNames).range(palette);
  }, [entityNames]);

  const frameDuration = useMemo(() => (config.duration * 1000) / dates.length, [config.duration, dates.length]);

  // Initialize nodes and simulation once
  useEffect(() => {
    const count = Math.min(entityNames.length, config.entitiesToShow);
    nodesRef.current = entityNames.slice(0, count).map(name => ({
      name,
      value: 0,
      targetRadius: 0,
      x: width / 2 + (Math.random() - 0.5) * 100,
      y: height / 2 + (Math.random() - 0.5) * 100,
      vx: 0,
      vy: 0
    }));

    simulationRef.current = d3.forceSimulation<BubbleNode>(nodesRef.current)
      .force('center', d3.forceCenter(width / 2, height / 2 + 30))
      .force('collide', d3.forceCollide<BubbleNode>().radius(d => d.targetRadius + 2).iterations(3))
      .force('charge', d3.forceManyBody().strength(5))
      .on('tick', () => {
        if (svgRef.current) {
          const svg = d3.select(svgRef.current);
          svg.selectAll<SVGGElement, BubbleNode>('.bubble-container')
            .attr('transform', d => `translate(${d.x}, ${d.y})`);
        }
      });

    return () => {
      simulationRef.current?.stop();
    };
  }, [entityNames, config.entitiesToShow]);

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
      if (typeof onFinished === 'function') {
        onFinished();
      }
    }
  }, [currentDateIndex, dates.length, onFinished]);

  useEffect(() => {
    if (!svgRef.current || nodesRef.current.length === 0) return;

    const svg = d3.select(svgRef.current);
    const date = dates[currentDateIndex];
    const currentData = data.filter(d => d.date === date);

    const globalMaxVal = d3.max(data, d => d.cumulativeValue) || 1;
    const maxPossibleRadius = Math.min(width, height) / 4.5;
    
    const radiusScale = d3.scaleSqrt()
      .domain([0, globalMaxVal])
      .range([0, maxPossibleRadius]);

    // Update node targets
    nodesRef.current.forEach(node => {
      const entityData = currentData.find(d => d.name === node.name);
      node.value = entityData ? entityData.cumulativeValue : 0;
      node.targetRadius = radiusScale(node.value);
    });

    // Restart simulation with new radii
    if (simulationRef.current) {
      simulationRef.current.force('collide', d3.forceCollide<BubbleNode>().radius(d => d.targetRadius + 2).iterations(3));
      simulationRef.current.alpha(0.3).restart();
    }

    const transition = d3.transition()
      .duration(frameDuration)
      .ease(d3.easeLinear);

    // Calques
    if (svg.select('.bg-layer').empty()) svg.append('g').attr('class', 'bg-layer');
    if (svg.select('.bubble-layer').empty()) svg.append('g').attr('class', 'bubble-layer');
    if (svg.select('.ui-layer').empty()) svg.append('g').attr('class', 'ui-layer');

    const bgLayer = svg.select('.bg-layer');
    const bubbleLayer = svg.select('.bubble-layer');
    const uiLayer = svg.select('.ui-layer');

    // Définitions des Gradients Radiaux pour l'effet 3D
    let defs = svg.select('defs');
    if (defs.empty()) defs = svg.append('defs');

    nodesRef.current.forEach(pos => {
      const gradId = `grad-bubble-${pos.name.replace(/\s+/g, '-')}`;
      if (defs.select(`#${gradId}`).empty()) {
        const grad = defs.append('radialGradient')
          .attr('id', gradId)
          .attr('cx', '35%').attr('cy', '35%').attr('r', '50%').attr('fx', '35%').attr('fy', '35%');
        
        grad.append('stop').attr('offset', '0%').attr('stop-color', '#FFFFFF').attr('stop-opacity', '0.9');
        grad.append('stop').attr('offset', '40%').attr('stop-color', colorScale(pos.name)).attr('stop-opacity', '1');
        grad.append('stop').attr('offset', '100%').attr('stop-color', d3.color(colorScale(pos.name))?.darker(2).toString() || '#000').attr('stop-opacity', '1');
      }
    });

    // Filigrane Date
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
      .text(date);

    // BULLES "GONFLANTES"
    const bubbleGroups = bubbleLayer.selectAll<SVGGElement, BubbleNode>('.bubble-container')
      .data(nodesRef.current, d => d.name);

    const bubbleEnter = bubbleGroups.enter()
      .append('g')
      .attr('class', 'bubble-container')
      .attr('transform', d => `translate(${d.x || width/2}, ${d.y || height/2})`);

    bubbleEnter.append('circle')
      .attr('class', 'main-bubble')
      .attr('r', 0)
      .attr('fill', d => `url(#grad-bubble-${d.name.replace(/\s+/g, '-')})`)
      .style('filter', 'drop-shadow(0px 10px 15px rgba(0,0,0,0.6))');

    bubbleEnter.append('text')
      .attr('class', 'label-name font-black uppercase tracking-tight')
      .attr('text-anchor', 'middle')
      .attr('fill', '#FFFFFF')
      .style('font-size', '12px')
      .style('pointer-events', 'none');

    bubbleEnter.append('text')
      .attr('class', 'label-value font-mono font-black')
      .attr('text-anchor', 'middle')
      .attr('fill', '#FFFFFF')
      .attr('opacity', 0.8)
      .attr('dy', '15px')
      .style('font-size', '10px')
      .style('pointer-events', 'none');

    const bubbleUpdate = bubbleEnter.merge(bubbleGroups);

    bubbleUpdate.each(function(d) {
      const g = d3.select(this);
      
      g.select('.main-bubble')
        .transition(transition)
        .attr('r', Math.max(0, d.targetRadius));

      g.select('.label-name')
        .transition(transition)
        .style('font-size', `${Math.max(8, d.targetRadius * 0.3)}px`)
        .text(d.name);

      g.select('.label-value')
        .transition(transition)
        .attr('dy', `${Math.max(10, d.targetRadius * 0.4)}px`)
        .style('font-size', `${Math.max(7, d.targetRadius * 0.25)}px`)
        .tween('text', function() {
          const current = parseFloat(this.textContent?.replace(/[^0-9.-]+/g, "") || "0");
          const i = d3.interpolateNumber(current, d.value);
          return function(t) { 
            this.textContent = Math.round(i(t)).toLocaleString(); 
          };
        });
    });

    bubbleGroups.exit().remove();

    // UI Titres
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
      .text("CÉLINA DATA ENGINE • BUBBLE 3D INFLATION ANALYSIS");

  }, [currentDateIndex, data, config, dates, colorScale, frameDuration]);

  return (
    <div className="bg-[#0f1423] p-6 rounded-[2.5rem] border border-slate-700 shadow-2xl overflow-hidden relative">
      <svg 
        id="racing-chart-svg" 
        ref={svgRef} 
        viewBox={`0 0 ${width} ${height}`} 
        className="w-full h-auto drop-shadow-2xl" 
      />
      <div className="mt-8 flex items-center gap-8 px-6 pb-2">
         <div className="flex-1 bg-slate-800 h-2 rounded-full overflow-hidden shadow-inner">
            <div className="bg-gradient-to-r from-orange-500 to-red-600 h-full shadow-[0_0_15px_rgba(249,115,22,0.5)] transition-all duration-300 ease-linear" style={{ width: `${(currentDateIndex / (dates.length - 1)) * 100}%` }} />
         </div>
         <div className="flex flex-col items-end min-w-[160px]">
            <span className="text-[9px] text-slate-500 uppercase tracking-widest font-black italic mb-1">Chronologie CÉLINA</span>
            <span className="text-xl text-orange-400 font-mono font-black tracking-tighter">{dates[currentDateIndex]}</span>
         </div>
      </div>
    </div>
  );
};

export default BubbleChart;
