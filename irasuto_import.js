//. irasuto_import.js
var client = require( 'cheerio-httpcli' );
var fs = require( 'fs' );
var request = require( 'request' );

var post_api_url = 'http://localhost:6040/image';
var base_category = '動物';
var encode_category = encodeURI( base_category );
var base_url = 'https://www.irasutoya.com/search/label/' + encode_category;


var count = 0;
var url = base_url;
checkURL( url );

function checkURL( url ){
  client.fetch( url, {}, function( err, $, res ){
    if( url.indexOf( encode_category ) > -1 ){
      count ++;
      $('div.boxim a').each( function(){
        var href = $(this).prop( 'href' );
        //console.log( ' href = ' + href );
        checkURL( href );
      });

      $('.blog-pager-older-link').each( function(){
        var href = $(this).prop( 'href' );
        //console.log( 'href = ' + href );

        if( count < 3 ){
          setTimeout( checkURL, 20000, href );
        }
      });
    }else{
      $('div.entry div.separator a img').each( function(){
        var src = $(this).prop( 'src' );
        var alt = $(this).prop( 'alt' );
        //console.log( ' alt = ' + alt + ', src = ' + src );

        //. 画像取得
        var option = {
          method: 'GET',
          url: src,
          encoding: null
        };
        request( option, function( err, res, body ){
          if( !err && res.statusCode == 200 ){
            //. 取得した画像を一旦保管
            var filename = 'tmp/' + alt + '.png';
            fs.writeFileSync( filename, body, 'binary' );
 
            //. 画像を /image API にポスト
            var formData = {
              'image': fs.createReadStream( filename )
            };
            request.post( { url: post_api_url, formData: formData }, function( err, res1, body ){
              fs.unlink( filename, function(e){} );
              if( err ){
                console.log( err );
              }else{
                console.log( body );
              }
            });
          }
        });
      });
    }
  });
}



