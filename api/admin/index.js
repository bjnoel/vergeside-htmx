// Export all admin API endpoints
const councilRoutes = require('./council');
const areaRoutes = require('./area');
const areaPolygonRoutes = require('./area_polygon_routes');

module.exports = function(adminSupabase, requireAdminAuth) {
  return {
    council: councilRoutes(adminSupabase, requireAdminAuth),
    area: areaRoutes(adminSupabase, requireAdminAuth),
    area_polygon: areaPolygonRoutes(adminSupabase, requireAdminAuth)
  };
};
