# ImageSearch

## Overview

Similar Image Search API & Sample application

## Install & Setting up API Platform

- `git clone` or `download zip & unzip` this repository

- `$ npm install`

    - if you got error( when installing canvas ), this can be workaround:

        - `$ npm install canvas --python=python2.7`

        - `$ npm install`

- `$ node app`

    - Message `server starting on NNNN ...` will be displayed. `NNNN` is running port number which is going to be used later.

- (Optional)If you are going to use Swagger API document, quit application once, edit **host** value in public/doc/swagger.yaml with your hostname and port number, and run API again: `$ node app`

## How to use Swagger API document

Access to /doc:  http(s)://hostname:NNNN/doc/

## How to import sample images(from [Irasutoya](https://www.irasutoya.com/))

- Edit following values in irasutoya_import.js:

    - **post_api_url** need to be set for your API server. Edit `localhost` and `6040` for your API server hostname and running port number.

    - **base_category** need to be set as retrieve target category of Irasutoya.

- Make sure your API server running.

- Import with this command:

    - `$ node irasutoya_import.js`

- You will find about 50 images would be imported as target from Irasutoya.


## How to use sample application

### Manual training, or Target list

Access to training.html:  http(s)://hostname:NNNN/training.html

### Find Similar Images

Access to top page: http(s)://hostname:NNNN/


## References

- Python executable "python" is v3.4.3, which is not supported by gyp

https://github.com/nodejs/node-gyp/issues/746


## Licensing

This code is licensed under MIT.

https://github.com/dotnsf/imagesearch/blob/master/LICENSE


## Copyright

2018 K.Kimura @ Juge.Me all rights reserved.
