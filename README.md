# Genesis Image Recognition Api

This is a Node.js web api using the Express.js framework

Currently it listens on Port 3000 and uses Nodemon to live refresh the application on code save


**Current Dependencies** <br>
   Express: ^4.17.1 <br>
   Nodemon: ^2.0.7 <br>
   @microsoft/customvision-tfjs-node": ^1.1.0<br>
   Tesseract.js: ^2.1.4 <br>
   Jimp: ^0.16.1<br>

**To Install the Dependencies** <br>
$ npm install express --save <br>
$ npm install nodemon --save <br>
$ npm install @microsoft/customvision-tfjs-node --save <br>
$ npm install tesseract.js --save <br>
$ npm install jimp --save <br>

**To run the application** <br>
$ npm start  <br>

**Program Structure** <br>
Firstly reads image file and uses Jimp to preprocess and the image and get image dimensions <br>
Currently uses tensorflow to detect and return co-ordinates of medicine boxes using model in './model/model.json' <br>
Tesseract is then given the co-ordinates for each medicine box and reads/prints the text <br>

**Documentation Links** <br>
Tesseract.js: https://github.com/naptha/tesseract.js <br>
Jimp: https://www.npmjs.com/package/jimp <br>
CustomVision-tfjs-node: https://github.com/microsoft/customvision-tfjs-node <br>
