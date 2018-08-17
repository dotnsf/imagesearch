exports.cloudant_username = '';
exports.cloudant_password = '';
exports.cloudant_db = 'imagesearch';
exports.image_size = 64;

if( process.env.VCAP_SERVICES ){
  var VCAP_SERVICES = JSON.parse( process.env.VCAP_SERVICES );
  if( VCAP_SERVICES && VCAP_SERVICES.cloudantNoSQLDB ){
    exports.cloudant_username = VCAP_SERVICES.cloudantNoSQLDB.credentials.username;
    exports.cloudant_password = VCAP_SERVICES.cloudantNoSQLDB.credentials.password;
  }
}
