// API endpoint for cached KML generation
import moment from 'moment';
import crypto from 'crypto';
import supabaseClient from '../../js/supabase-client.js';
import { CONFIG } from '../../js/config.js';

// Cache duration in seconds (24 hours)
const CACHE_DURATION = 24 * 60 * 60;

export default async function handler(req, res) {
  // Parse query parameters
  const { startDate, endDate, councilId } = req.query;
  
  if (!startDate || !endDate) {
    return res.status(400).json({ error: 'startDate and endDate are required parameters' });
  }
  
  try {
    // Generate a cache key based on request parameters
    const cacheKey = generateCacheKey(startDate, endDate, councilId);
    
    // Set cache control headers for Cloudflare
    res.setHeader('Cache-Control', `public, max-age=${CACHE_DURATION}`);
    res.setHeader('Content-Type', 'application/vnd.google-earth.kml+xml');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    // Check if we have this KML cached in Supabase
    const { data: cachedKml, error: cacheError } = await supabaseClient.supabase
      .from('kml_cache')
      .select('kml_content, created_at')
      .eq('cache_key', cacheKey)
      .single();
    
    // If we have a valid cache entry, return it
    if (cachedKml && !cacheError) {
      const createdAt = new Date(cachedKml.created_at);
      const now = new Date();
      const cacheAge = (now - createdAt) / 1000; // in seconds
      
      if (cacheAge < CACHE_DURATION) {
        // Cache is still valid, return it
        console.log(`Cache hit for key: ${cacheKey}`);
        return res.status(200).send(cachedKml.kml_content);
      } else {
        // Cache is stale, delete it
        await supabaseClient.supabase
          .from('kml_cache')
          .delete()
          .eq('cache_key', cacheKey);
      }
    }
    
    // No valid cache, generate new KML
    console.log(`Cache miss for key: ${cacheKey}, generating new KML`);
    
    // Fetch all areas, pickups, and polygons needed
    const pickups = await supabaseClient.getAllPickups(startDate, endDate);
    const areas = await supabaseClient.getAreas(councilId);
    
    // Group pickups by area
    const areaPickupMap = new Map();
    pickups.forEach(pickup => {
      if (!areaPickupMap.has(pickup.area_id)) {
        areaPickupMap.set(pickup.area_id, []);
      }
      areaPickupMap.get(pickup.area_id).push(pickup);
    });
    
    // Generate KML for each area
    let placemarkXml = '';
    for (const area of areas) {
      if (areaPickupMap.has(area.id)) {
        const areaPickups = areaPickupMap.get(area.id);
        if (areaPickups && areaPickups.length > 0) {
          const polygons = await supabaseClient.getAreaPolygons(area.id);
          if (polygons.length > 0) {
            placemarkXml += generateAreaKml(area, areaPickups, polygons);
          }
        }
      }
    }
    
    // Assemble the complete KML document
    const kml = `<?xml version="1.0" encoding="UTF-8"?>
      <kml xmlns="http://www.opengis.net/kml/2.2">
        <Document>
          <name>Vergeside Pickups</name>
          <description>Vergeside collection dates from ${startDate} to ${endDate}</description>
          ${generateStylesKml()}
          <Folder>
            <name>Vergeside Overlays</name>
            ${placemarkXml}
          </Folder>
        </Document>
      </kml>
    `;
    
    // Store the new KML in the cache
    try {
      await supabaseClient.supabase
        .from('kml_cache')
        .insert([
          { 
            cache_key: cacheKey,
            kml_content: kml,
            parameters: JSON.stringify({ startDate, endDate, councilId }),
            created_at: new Date().toISOString()
          }
        ]);
      console.log(`KML stored in cache with key: ${cacheKey}`);
    } catch (insertError) {
      console.error('Error inserting KML into cache:', insertError);
      // Continue even if caching fails
    }
    
    return res.status(200).send(kml);
  } catch (error) {
    console.error('Error handling KML request:', error);
    return res.status(500).json({ error: 'Failed to generate KML' });
  }
}

// Generate a unique cache key based on request parameters
function generateCacheKey(startDate, endDate, councilId) {
  const keyString = `kml-${startDate}-${endDate}-${councilId || 'all'}`;
  return crypto.createHash('md5').update(keyString).digest('hex');
}

// Generate KML styles based on the color scheme
function generateStylesKml() {
  let stylesXml = '';
  
  // Create style entries for each color in the configuration
  Object.entries(CONFIG.COLORS).forEach(([key, color]) => {
    // Convert hex color to KML format (aabbggrr)
    const hexColor = color.replace('#', '');
    const r = hexColor.substr(0, 2);
    const g = hexColor.substr(2, 2);
    const b = hexColor.substr(4, 2);
    
    // Create normal style
    const normalOpacity = 'ff';
    const highlightOpacity = '73';
    
    const lineColor = `${normalOpacity}${b}${g}${r}`;
    const polyColor = `${normalOpacity}${b}${g}${r}`;
    const highlightLineColor = `${highlightOpacity}${b}${g}${r}`;
    const highlightPolyColor = `${highlightOpacity}${b}${g}${r}`;
    
    const styleName = key.toLowerCase();
    
    // Normal style
    stylesXml += `
      <Style id="${styleName}-normal">
        <LineStyle>
          <color>${lineColor}</color>
          <width>3</width>
        </LineStyle>
        <PolyStyle>
          <color>${polyColor}</color>
          <fill>1</fill>
          <outline>1</outline>
        </PolyStyle>
      </Style>
    `;
    
    // Highlight style
    stylesXml += `
      <Style id="${styleName}-highlight">
        <LineStyle>
          <color>${highlightLineColor}</color>
          <width>4.5</width>
        </LineStyle>
        <PolyStyle>
          <color>${highlightPolyColor}</color>
          <fill>1</fill>
          <outline>1</outline>
        </PolyStyle>
      </Style>
    `;
    
    // Style map
    stylesXml += `
      <StyleMap id="${styleName}">
        <Pair>
          <key>normal</key>
          <styleUrl>#${styleName}-normal</styleUrl>
        </Pair>
        <Pair>
          <key>highlight</key>
          <styleUrl>#${styleName}-highlight</styleUrl>
        </Pair>
      </StyleMap>
    `;
  });
  
  return stylesXml;
}

// Determines which color/style to use based on the pickup date
function getStyleForDate(pickupDate) {
  const today = moment().startOf('day');
  const pickup = moment(pickupDate).startOf('day');
  const daysUntilPickup = pickup.diff(today, 'days');
  
  if (daysUntilPickup < 0) {
    return 'default';
  } else if (daysUntilPickup === 0) {
    return 'today';
  } else if (daysUntilPickup <= 7) {
    return 'this_week';
  } else if (daysUntilPickup <= 14) {
    return 'next_week';
  } else if (daysUntilPickup <= 21) {
    return 'two_weeks';
  } else if (daysUntilPickup <= 28) {
    return 'three_weeks';
  } else {
    return 'four_plus_weeks';
  }
}

// Format pickup dates similarly to the C# implementation
function formatPickupDates(pickups) {
  if (!pickups || pickups.length === 0) return '';
  
  // Sort pickups by date and extract unique dates
  const startDates = [...new Set(
    pickups
      .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))
      .map(p => moment(p.start_date).format('DD MMM YYYY'))
  )];
  
  return startDates.join(' and ');
}

// Parse coordinates from string format: "lng1,lat1,alt1 lng2,lat2,alt2 ..."
function parseCoordinates(coordinateString) {
  if (!coordinateString || coordinateString.trim() === '') {
    return '';
  }
  
  // Check if it's already a string in KML format
  if (typeof coordinateString === 'string' && !coordinateString.startsWith('[')) {
    return coordinateString.trim();
  }
  
  // If it's stored as JSON, convert to KML coordinate format
  try {
    const coordsArray = typeof coordinateString === 'string' 
      ? JSON.parse(coordinateString) 
      : coordinateString;
    
    return coordsArray.map(coord => {
      return `${coord.lng},${coord.lat},0`;
    }).join(' ');
  } catch (error) {
    console.error("Error parsing coordinates:", error);
    return coordinateString; // Return as is if parsing fails
  }
}

// Generate KML for a single area with its pickups and polygons
function generateAreaKml(area, pickups, polygons) {
  if (!pickups || pickups.length === 0 || !polygons || polygons.length === 0) {
    return '';
  }

  // Sort pickups by date
  const sortedPickups = [...pickups].sort((a, b) => 
    new Date(a.start_date) - new Date(b.start_date)
  );
  
  // Get the earliest pickup date to determine the style
  const nextPickupDate = sortedPickups[0].start_date;
  const styleKey = getStyleForDate(nextPickupDate);
  
  // Build polygons XML
  let polygonsXml = '';
  try {
    if (polygons.length === 1) {
      // The coordinates are already in KML format or JSON
      const coordinates = parseCoordinates(polygons[0].coordinates);
      
      polygonsXml = `
        <Polygon>
          <outerBoundaryIs>
            <LinearRing>
              <tessellate>1</tessellate>
              <coordinates>${coordinates}</coordinates>
            </LinearRing>
          </outerBoundaryIs>
        </Polygon>
      `;
    } else {
      let multiPolygonXml = '';
      polygons.forEach((polygon, index) => {
        // The coordinates are already in KML format or JSON
        const coordinates = parseCoordinates(polygon.coordinates);
        
        multiPolygonXml += `
          <Polygon>
            <outerBoundaryIs>
              <LinearRing>
                <tessellate>1</tessellate>
                <coordinates>${coordinates}</coordinates>
              </LinearRing>
            </outerBoundaryIs>
          </Polygon>
        `;
      });
      
      polygonsXml = `
        <MultiGeometry>
          ${multiPolygonXml}
        </MultiGeometry>
      `;
    }
  } catch (error) {
    console.error("Error building polygon XML:", error);
    // Return empty XML in case of error
    polygonsXml = '';
  }
  
  // Format description with pickup dates
  const description = formatPickupDates(sortedPickups);
  
  // Return the KML for this area
  return `
    <Placemark>
      <name>${area.name}</name>
      <description>${description}</description>
      <styleUrl>#${styleKey}</styleUrl>
      ${polygonsXml}
    </Placemark>
  `;
}