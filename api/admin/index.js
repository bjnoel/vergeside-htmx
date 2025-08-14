// Export all admin API endpoints
const councilRoutes = require('./council');
const areaRoutes = require('./area');
const areaPolygonRoutes = require('./area_polygon_routes');
const emailSubscribersRoutes = require('./email_subscribers');
const emailSendLogRoutes = require('./email_send_log');

module.exports = function(adminSupabase, requireAdminAuth) {
  return {
    council: councilRoutes(adminSupabase, requireAdminAuth),
    area: areaRoutes(adminSupabase, requireAdminAuth),
    area_polygon: areaPolygonRoutes(adminSupabase, requireAdminAuth),
    email_subscribers: emailSubscribersRoutes(adminSupabase, requireAdminAuth),
    email_send_log: emailSendLogRoutes(adminSupabase, requireAdminAuth)
  };
};
