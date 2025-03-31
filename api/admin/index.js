// Export all admin API endpoints
const councilRoutes = require('./council');
const areaRoutes = require('./area');

module.exports = function(adminSupabase, requireAdminAuth) {
  return {
    council: councilRoutes(adminSupabase, requireAdminAuth),
    area: areaRoutes(adminSupabase, requireAdminAuth)
  };
};
