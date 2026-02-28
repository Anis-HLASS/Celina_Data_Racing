
import { RawDataRow, ProcessedDataPoint, ColumnMapping } from '../types';

/**
 * Robust data cleaner and ETL engine
 */
export const processData = (
  raw: RawDataRow[],
  mapping: ColumnMapping
): ProcessedDataPoint[] => {
  const { dateCol, entityCol, valueCol } = mapping;

  // 1. Initial Cleaning & Type Conversion
  const cleaned: ProcessedDataPoint[] = raw.map(row => {
    let dateStr = "";
    const dateVal = row[dateCol];
    
    // Robust Date handling: avoid UTC shifting issues (common with toISOString)
    if (dateVal instanceof Date) {
      // Use local date components to ensure we get the date exactly as displayed in Excel
      const year = dateVal.getFullYear();
      const month = String(dateVal.getMonth() + 1).padStart(2, '0');
      const day = String(dateVal.getDate()).padStart(2, '0');
      dateStr = `${year}-${month}-${day}`;
    } else {
      // If it's a string, normalize to YYYY-MM-DD if possible
      dateStr = String(dateVal || "").trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        // Support common date formats like DD/MM/YYYY
        const parts = dateStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
        if (parts) {
          dateStr = `${parts[3]}-${parts[2].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
        }
      }
    }

    const value = parseFloat(String(row[valueCol] || "0").replace(/[^0-9.-]+/g, "")) || 0;
    
    return {
      date: dateStr,
      name: String(row[entityCol] || "Unknown"),
      value: value,
      cumulativeValue: 0 // placeholder
    };
  });

  // 2. FILTRAGE DES DIMANCHES : Exclusion radicale de la chronologie
  const filteredData = cleaned.filter(item => {
    // On force l'heure à midi (T12:00:00) pour neutraliser les décalages de Timezone
    // qui pourraient faire basculer le jour lors du parsing d'une date à minuit.
    const dateObj = new Date(item.date + 'T12:00:00');
    
    // Vérification : Date valide ET n'est pas un Dimanche (0 en JavaScript)
    // Cette règle s'applique à la fois au Bar Chart Race et à la Courbe Linéaire.
    return !isNaN(dateObj.getTime()) && dateObj.getDay() !== 0;
  });

  // 3. Identify all unique entities and unique dates from filtered data
  const entities = Array.from(new Set(filteredData.map(d => d.name)));
  const rawDates = Array.from(new Set(filteredData.map(d => d.date))).sort((a, b) => 
    new Date(a).getTime() - new Date(b).getTime()
  );

  // 4. Gap Filling (Matrix construction)
  // Ensure every entity exists for every remaining date (excluding Sundays)
  const matrix: ProcessedDataPoint[] = [];
  const entityMap = new Map<string, Map<string, number>>();

  filteredData.forEach(item => {
    if (!entityMap.has(item.name)) entityMap.set(item.name, new Map());
    entityMap.get(item.name)!.set(item.date, item.value);
  });

  // Generate all dates between min and max
  const dates: string[] = [];
  if (rawDates.length > 0) {
    let currentDate = new Date(rawDates[0] + 'T12:00:00');
    const end = new Date(rawDates[rawDates.length - 1] + 'T12:00:00');

    while (currentDate <= end) {
      if (currentDate.getDay() !== 0) { // Exclude Sundays
        const year = currentDate.getFullYear();
        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
        const day = String(currentDate.getDate()).padStart(2, '0');
        dates.push(`${year}-${month}-${day}`);
      }
      // LIGNE CRITIQUE QUI EMPÊCHE LA BOUCLE INFINIE :
      currentDate.setDate(currentDate.getDate() + 1);
    }
  }

  // 5. Build final matrix with gap filling and cumulative calculation
  const cumulativeTotals = new Map<string, number>();
  entities.forEach(name => cumulativeTotals.set(name, 0));

  dates.forEach(date => {
    entities.forEach(name => {
      const dailyValue = entityMap.get(name)?.get(date) || 0;
      const currentTotal = cumulativeTotals.get(name)! + dailyValue;
      cumulativeTotals.set(name, currentTotal);

      matrix.push({
        date,
        name,
        value: dailyValue,
        cumulativeValue: currentTotal
      });
    });
  });

  return matrix;
};

export const getDates = (data: ProcessedDataPoint[]) => {
  return Array.from(new Set(data.map(d => d.date))).sort();
};
