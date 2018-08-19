//. app.js

var express = require( 'express' ),
    basicAuth = require( 'basic-auth-connect' ),
    Canvas = require( 'canvas' ),
    cfenv = require( 'cfenv' ),
    easyimg = require( 'easyimage' ),
    multer = require( 'multer' ),
    bodyParser = require( 'body-parser' ),
    fs = require( 'fs' ),
    ejs = require( 'ejs' ),
    cloudantlib = require( 'cloudant' ),
    app = express();
var settings = require( './settings' );
var appEnv = cfenv.getAppEnv();
var Image = Canvas.Image;

app.use( multer( { dest: './tmp/' } ).single( 'image' ) );
app.use( bodyParser.urlencoded( { extended: true } ) );
app.use( bodyParser.json() );
app.use( express.Router() );
app.use( express.static( __dirname + '/public' ) );

var imagesearchdb = null;
var cloudant = null;
if( settings.cloudant_username && settings.cloudant_password ){
  var params = { account: settings.cloudant_username, password: settings.cloudant_password };
  cloudant = cloudantlib( params );

  if( cloudant ){
    cloudant.db.get( settings.cloudant_db, function( err, body ){
      if( err ){
        if( err.statusCode == 404 ){
          cloudant.db.create( settings.cloudant_db, function( err, body ){
            if( err ){
              //. 'Error: server_admin access is required for this request' for Cloudant Local
              //. 'Error: insernal_server_error'
              imagesearchdb = null;
            }else{
              imagesearchdb = cloudant.db.use( settings.cloudant_db );
            }
          });
        }else{
          imagesearchdb = null;
        }
      }else{
        imagesearchdb = cloudant.db.use( settings.cloudant_db );
      }
    });
  }
}


app.post( '/search', function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );
  var _limit = req.query.limit ? req.query.limit : '';
  var limit = ( _limit ? parseInt( _limit ) : 5 );
  var rev = ( req.query.rev ? true : false );
  console.log( 'POST /search?limit=' + limit );

  if( imagesearchdb ){
    var imgpath = req.file.path;
    var imgtype = req.file.mimetype;
    var imgname = req.file.originalname; //. "blob"

    //. https://www.npmjs.com/package/easyimage
    var dst_imgpath = imgpath + '.png';
    var options = {
      src: imgpath,
      dst: dst_imgpath,
      ignoreAspectRatio: true,
      width: settings.image_size,
      height: settings.image_size
    };

    easyimg.resize( options ).then(
      function( file ){
        getPixels( dst_imgpath, true ).then( function( pixels ){
          fs.unlink( imgpath, function(e){} );
          fs.unlink( dst_imgpath, function(e){} );
          imagesearchdb.list( { include_docs: true }, function( err, body ){
            if( err ){
              res.status( 400 );
              res.write( JSON.stringify( { status: false, message: err }, 2, null ) );
              res.end();
            }else{
              var docs = [];
              body.rows.forEach( function( doc ){
                var _doc = JSON.parse(JSON.stringify(doc.doc));
                if( _doc._id.indexOf( '_' ) !== 0 ){
                  //. スコア計算
                  var score = countScore( pixels, _doc.pixels );
                  _doc.score = score;
                  delete _doc['pixels'];

                  docs.push( _doc );
                }
              });

              docs.sort( compareByScore ); //. スコアの小さい順にソート
              docs = docs.slice( 0, limit );

              var result = { status: true, docs: docs };
              res.write( JSON.stringify( result, 2, null ) );
              res.end();
            }
          });
        }, function( err ){
          fs.unlink( imgpath, function(e){} );
          fs.unlink( dst_imgpath, function(e){} );
          res.write( JSON.stringify( { status: false, error: err }, 2, null ) );
          res.end();
        });
      }, function( err ){
        //. for Windows (??)
        getPixels( dst_imgpath ).then( function( pixels ){
          fs.unlink( imgpath, function(e){} );
          fs.unlink( dst_imgpath, function(e){} );
          imagesearchdb.list( { include_docs: true }, function( err, body ){
            if( err ){
              res.status( 400 );
              res.write( JSON.stringify( { status: false, message: err }, 2, null ) );
              res.end();
            }else{
              var docs = [];
              body.rows.forEach( function( doc ){
                var _doc = JSON.parse(JSON.stringify(doc.doc));
                if( _doc._id.indexOf( '_' ) !== 0 ){
                  //. スコア計算
                  var score = countScore( pixels, _doc.pixels );
                  _doc.score = score;
                  delete _doc['pixels'];

                  docs.push( _doc );
                }
              });

              docs.sort( compareByScore ); //. スコアの小さい順にソート
              docs = docs.slice( 0, limit );

              var result = { status: true, docs: docs };
              res.write( JSON.stringify( result, 2, null ) );
              res.end();
            }
          });
        }, function( err ){
          fs.unlink( imgpath, function(e){} );
          fs.unlink( dst_imgpath, function(e){} );
          res.write( JSON.stringify( { status: false, error: err }, 2, null ) );
          res.end();
        });
      }
    );
  }else{
    res.status( 400 );
    res.write( JSON.stringify( { status: false, message: 'db is failed to initialize.' }, 2, null ) );
    res.end();
  }
});

app.post( '/image', function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );
  console.log( 'POST /image' );

  if( imagesearchdb ){
    var imgpath = req.file.path;
    var imgtype = req.file.mimetype;
    var imgname = req.file.originalname;

    //. https://www.npmjs.com/package/easyimage
    var dst_imgpath = imgpath + '.png';
    var options = {
      src: imgpath,
      dst: dst_imgpath,
      ignoreAspectRatio: true,
      width: settings.image_size,
      height: settings.image_size
    };

    easyimg.resize( options ).then(
      function( file ){
        getPixels( dst_imgpath ).then( function( pixels ){
          var bin = fs.readFileSync( imgpath );
          var bin64 = new Buffer( bin ).toString( 'base64' );
          var dst_bin = fs.readFileSync( dst_imgpath );
          var dst_bin64 = new Buffer( dst_bin ).toString( 'base64' );

          var doc = {};
          doc.timestamp = ( new Date() ).getTime();
          doc.filename = imgname;
          doc.pixels = pixels;
          doc['_attachments'] = {
            file: {
              content_type: imgtype,
              data: bin64
            },
            dst_file: {
              content_type: imgtype,
              data: dst_bin64
            },
          };

          imagesearchdb.insert( doc, function( err, body ){
            fs.unlink( imgpath, function(e){} );
            fs.unlink( dst_imgpath, function(e){} );
            if( err ){
              console.log( err );
              res.status( 400 );
              res.write( JSON.stringify( { status: false, message: err }, 2, null ) );
              res.end();
            }else{
              //console.log( body );
              res.write( JSON.stringify( { status: true, /*pixels: pixels,*/ message: body }, 2, null ) );
              res.end();
            }
          });
        }, function( err ){
          fs.unlink( imgpath, function(e){} );
          fs.unlink( dst_imgpath, function(e){} );
          res.write( JSON.stringify( { status: false, error: err }, 2, null ) );
          res.end();
        });
      }, function( err ){
        //. for Windows (??)
        getPixels( dst_imgpath ).then( function( pixels ){
          var bin = fs.readFileSync( imgpath );
          var bin64 = new Buffer( bin ).toString( 'base64' );
          var dst_bin = fs.readFileSync( dst_imgpath );
          var dst_bin64 = new Buffer( dst_bin ).toString( 'base64' );

          var doc = {};
          doc.timestamp = ( new Date() ).getTime();
          doc.filename = imgname;
          doc.pixels = pixels;
          doc['_attachments'] = {
            file: {
              content_type: imgtype,
              data: bin64
            },
            dst_file: {
              content_type: imgtype,
              data: dst_bin64
            },
          };

          imagesearchdb.insert( doc, function( err, body ){
            fs.unlink( imgpath, function(e){} );
            fs.unlink( dst_imgpath, function(e){} );
            if( err ){
              console.log( err );
              res.status( 400 );
              res.write( JSON.stringify( { status: false, message: err }, 2, null ) );
              res.end();
            }else{
              //console.log( body );
              res.write( JSON.stringify( { status: true, /*pixels: pixels,*/ message: body }, 2, null ) );
              res.end();
            }
          });
        }, function( err ){
          fs.unlink( imgpath, function(e){} );
          fs.unlink( dst_imgpath, function(e){} );
          res.write( JSON.stringify( { status: false, error: err }, 2, null ) );
          res.end();
        });
      }
    );
  }else{
    res.status( 400 );
    res.write( JSON.stringify( { status: false, message: 'db is failed to initialize.' }, 2, null ) );
    res.end();
  }
});

app.get( '/image/:id', function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );
  var id = req.params.id;
  console.log( 'GET /image/' + id );
  var include_pixels = ( req.query.include_pixels ? true : false );

  if( imagesearchdb ){
    imagesearchdb.get( id, { include_docs: true }, function( err, doc ){
      if( err ){
        res.status( 400 );
        res.write( JSON.stringify( { status: false, message: err }, 2, null ) );
        res.end();
      }else{
        if( !include_pixels ){
          delete doc['pixels'];
        }
        res.write( JSON.stringify( { status: true, doc: doc }, 2, null ) );
        res.end();
      }
    });
  }else{
    res.status( 400 );
    res.write( JSON.stringify( { status: false, message: 'db is failed to initialize.' }, 2, null ) );
    res.end();
  }
});

app.get( '/attachment/:id', function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );
  var id = req.params.id;
  var key = req.query.key ? req.query.key : '';  //. 'file' or 'dst_file'
  if( key != 'file' && key != 'dst_file' ){ key = 'file'; }
  console.log( 'GET /attachment/' + id + '?key=' + key );

  if( imagesearchdb ){
    imagesearchdb.get( id, { include_docs: true }, function( err, doc ){
      if( err ){
        res.status( 400 );
        res.write( JSON.stringify( { status: false, message: err }, 2, null ) );
        res.end();
      }else{
        if( doc._attachments ){
          if( key in doc._attachments ){
            var attachment = doc._attachments[key];
            if( attachment.content_type ){
              res.contentType( attachment.content_type );
            }

            //. 添付画像バイナリを取得する
            imagesearchdb.attachment.get( id, key, function( err, buf ){
              if( err ){
                res.contentType( 'application/json; charset=utf-8' );
                res.status( 400 );
                res.write( JSON.stringify( { status: false, message: err }, 2, null ) );
                res.end();
              }else{
                res.end( buf, 'binary' );
              }
            });
          }else{
            res.status( 400 );
            res.write( JSON.stringify( { status: false, message: 'attachment image not found.' }, 2, null ) );
            res.end();
          }
        }
      }
    });
  }else{
    res.status( 400 );
    res.write( JSON.stringify( { status: false, message: 'db is failed to initialize.' }, 2, null ) );
    res.end();
  }
});

app.get( '/images', function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );
  //var type = req.query.type;
  var limit = req.query.limit ? parseInt( req.query.limit ) : 0;
  var offset = req.query.offset ? parseInt( req.query.offset ) : 0;
  console.log( 'GET /images?limit=' + limit + '&offset=' + offset );

  if( imagesearchdb ){
    imagesearchdb.list( { include_docs: true }, function( err, body ){
      if( err ){
        res.status( 400 );
        res.write( JSON.stringify( { status: false, message: err }, 2, null ) );
        res.end();
      }else{
        var docs = [];
        body.rows.forEach( function( doc ){
          var _doc = JSON.parse(JSON.stringify(doc.doc));
          if( _doc._id.indexOf( '_' ) !== 0 ){
            docs.push( _doc );
          }
        });

        docs.sort( compareByTimestampRev ); //. 時系列逆順ソート

        if( offset || limit ){
          docs = docs.slice( offset, offset + limit );
        }

        var result = { status: true, docs: docs };
        res.write( JSON.stringify( result, 2, null ) );
        res.end();
      }
    });
  }else{
    res.status( 400 );
    res.write( JSON.stringify( { status: false, message: 'db is failed to initialize.' }, 2, null ) );
    res.end();
  }
});

app.delete( '/image/:id', function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );
  var id = req.params.id;
  console.log( 'DELETE /image/' + id );

  if( imagesearchdb ){
    imagesearchdb.get( id, function( err, doc ){
      if( err ){
        res.status( 400 );
        res.write( JSON.stringify( { status: false, message: err }, 2, null ) );
        res.end();
      }else{
        imagesearchdb.destroy( id, doc._rev, function( err, body ){
          if( err ){
            res.status( 400 );
            res.write( JSON.stringify( { status: false, message: err }, 2, null ) );
            res.end();
          }else{
            res.write( JSON.stringify( { status: true }, 2, null ) );
            res.end();
          }
        });
      }
    });
  }else{
    res.status( 400 );
    res.write( JSON.stringify( { status: false, message: 'db is failed to initialize.' }, 2, null ) );
    res.end();
  }
});


function getPixels( filepath, rev ){
  return new Promise( function( resolve, reject ){
    fs.readFile( filepath, function( err, data ){
      if( err ){
        reject( err );
      }else{
        var pixels = [];
        var img = new Image();
        img.src = data;
        var canvas = new Canvas( settings.image_size, settings.image_size );
        var ctx = canvas.getContext( '2d' );
        ctx.drawImage( img, 0, 0, img.width, img.height );

        var imagedata = ctx.getImageData( 0, 0, img.width, img.height );

        for( var y = 0; y < imagedata.height; y ++ ){
          var line = [];
          for( var x = 0; x < imagedata.width; x ++ ){
            var idx = ( y * imagedata.width + x ) * 4;
            var R = imagedata.data[idx];
            var G = imagedata.data[idx+1];
            var B = imagedata.data[idx+2];
            var A = imagedata.data[idx+3];

            if( rev ){
              R = 255 - R;
              G = 255 - G;
              B = 255 - B;
            }
            R = Math.floor( R / 4 );
            G = Math.floor( G / 4 );
            B = Math.floor( B / 4 );

            var pixel = [ R, G, B ];
            pixels.push( pixel );
          }
        }
        //console.log( '#pixels=' + pixels.length ); //. 4096 にならない？
        resolve( pixels );
      }
    });
  });
}

function countScore( pixels1, pixels2 ){
  var score = 0;
  for( var i = 0; i < pixels1.length; i ++ ){
    for( var j = 0; j < pixels1[i].length; j ++ ){
      var s = ( pixels1[i][j] - pixels2[i][j] ) * ( pixels1[i][j] - pixels2[i][j] );
      score += s;
    }
  }

  return score;
}

function compareByTimestamp( a, b ){
  var r = 0;
  if( a.timestamp < b.timestamp ){ r = -1; }
  else if( a.timestamp > b.timestamp ){ r = 1; }

  return r;
}

function compareByTimestampRev( a, b ){
  var r = 0;
  if( a.timestamp < b.timestamp ){ r = 1; }
  else if( a.timestamp > b.timestamp ){ r = -1; }

  return r;
}

function compareByScore( a, b ){
  var r = 0;
  if( a.score < b.score ){ r = -1; }
  else if( a.score > b.score ){ r = 1; }

  return r;
}

function timestamp2datetime( ts ){
  var dt = new Date( ts );
  var yyyy = dt.getFullYear();
  var mm = dt.getMonth() + 1;
  var dd = dt.getDate();
  var hh = dt.getHours();
  var nn = dt.getMinutes();
  var ss = dt.getSeconds();
  var datetime = yyyy + '-' + ( mm < 10 ? '0' : '' ) + mm + '-' + ( dd < 10 ? '0' : '' ) + dd
    + ' ' + ( hh < 10 ? '0' : '' ) + hh + ':' + ( nn < 10 ? '0' : '' ) + nn + ':' + ( ss < 10 ? '0' : '' ) + ss;
  return datetime;
}



app.listen( appEnv.port );
console.log( "server stating on " + appEnv.port + " ..." );
