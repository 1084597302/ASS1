var express = require("express");
var app = express();
const multer =  require('multer')
const path = require('path')
const Jimp = require('jimp');
const { createWorker, PSM, createScheduler } = require('tesseract.js');
var fs = require('fs');
const cvstfjs = require('@microsoft/customvision-tfjs-node');
var natural = require('natural');

const scheduler = createScheduler();
const worker1 = createWorker();
const worker2 = createWorker();

var imageWidth = 0;
var imageHeight = 0;

//Preprocess image to improve results and get image details
const processImage = async () => {

  const image = await Jimp.read('./testimages/test18.png')
  var ratio = image.bitmap.width / image.bitmap.height;
  var scaleDownX = 800;
  var scaleDownY = scaleDownX / ratio;
  imageWidth = scaleDownX;
  imageHeight = scaleDownY;

    await image
    //.rotate(90)
    .resize(scaleDownX, Jimp.AUTO, Jimp.RESIZE_BEZIER)
    .contrast(0.075)
    .greyscale()

    .threshold({max: 200})
    //.posterize(550)
    //.quality(100)



      .writeAsync('mededited.png'); // save
}

//Convert tensorflow outputs to usable tesseract inputs for box locations
const getCoords = (coords) => {

  //Cutoff for valid tensorflow object probabilities 
  const probabilityCutoff = 0.4

  var length = 0;
  //Counts how many viable objects have been detected by Tensorflow
  for(let i = 0; i < coords[2].length; i++){
    if(coords[1][i] >= probabilityCutoff){
      length++;
    }
  }
  coordScaled = [];

  //Turns tensorflow object position values into image coordinates
  //eg. 0.5 for x value becomes imageWidth*0.5 (half width)
  if(length == 1){
    rectangle = {
      left: 0,
      top: 0,
      width: imageWidth,
      height: imageHeight,
    }
    coordScaled.push(rectangle)
  }else {
    for(let i = 0; i < length; i++){
      rectangle = {
        left: (coords[0][i][0])*imageWidth,
        top: (coords[0][i][1])*imageHeight,
        width: ((coords[0][i][2])-(coords[0][i][0]))*imageWidth,
        height: ((coords[0][i][3])-(coords[0][i][1]))*imageHeight,
      }
      coordScaled.push(rectangle)
    }
  }


  return coordScaled;
}

//Detect text on image 
//rectangles: coordinates of each medical box
const imgToText = async (rectangles) => {

  //Create and setup workers (aka. threads) for tesseract recognition
  await worker1.load();
  await worker2.load();
  await worker1.loadLanguage('eng');
  await worker2.loadLanguage('eng');
  await worker1.initialize('eng');
  await worker2.initialize('eng');
  await worker1.setParameters({
    tessedit_pageseg_mode: PSM.AUTO,
    tessedit_char_whitelist: 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ (),-®',
  });
  await worker2.setParameters({
    tessedit_pageseg_mode: PSM.AUTO,
    tessedit_char_whitelist: 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ (),-®',
  });

  //Add workers to schedule so they operate simultaneously (to speed up application)
  scheduler.addWorker(worker1);
  scheduler.addWorker(worker2);

  //Iterate through each defined box area to read and print text
  const results = await Promise.all(rectangles.map((rectangle) => (
    scheduler.addJob('recognize', './mededited.png', { rectangle })
  )));
  
  var boxText = [];
  boxText.push(results.map(r => r.data.text));
  await scheduler.terminate();

  return boxText;
}

const getDataFromText = async (text) => {
  data = []
  for(let i = 0; i < text[0].length; i++){
    const regex = /(\d+\s*(?:mL|g|gallon|kg|L|mg|patches|Mg|G|ML|MG|ml))/g;
    const dosage = text[0][i].match(regex);
    
    const form = text[0][i].match(/tablet|capsule|granule|tablets|syrup|capsules|granules/i)

    var tokenizer = new natural.RegexpTokenizer({pattern: /\n+/});;
    console.log(tokenizer.tokenize(text[0][i]));
    const tokens = tokenizer.tokenize(text[0][i])
    var classifier = new natural.BayesClassifier();
    classifier.addDocument('PRESCRIPTION', 'junk');
    classifier.addDocument('PRESCRIPTION ONLY MEDIC', 'junk');
    classifier.addDocument('PRESCRIPTION ONLY MEDICINE', 'junk');
    classifier.addDocument('KEEP OUT OF REACH OF CHILDREN', 'junk');
    classifier.addDocument('l Pristiqfr', 'medicine');
    classifier.addDocument('desvenlafaxine 50 mg', 'medicine');
    classifier.addDocument('28 x50 mg desvenlafaxine as the succinate', 'medicine');
    classifier.addDocument('extended rel', 'junk');
    classifier.addDocument('1l Mylan', 'medicine');
    classifier.addDocument('(as sodium monohydrate)', 'medicine');
    classifier.addDocument('PRESION ONLY MEDIC', 'junk');
    classifier.addDocument('KEEP OUT OF', 'junk');
    classifier.addDocument('Staphylex -', 'medicine');
    classifier.addDocument('desvenlafaxine 50 mg', 'medicine');
    classifier.addDocument('CORTIMENT', 'medicine');
    classifier.addDocument('budesonide 9 mg', 'medicine');
    classifier.addDocument('FERRING', 'medicine');
    classifier.addDocument('CORTIMENT', 'medicine');
    classifier.addDocument('CORTIMENT', 'medicine');
    classifier.addDocument('PRESCRIPTI', 'junk');
    classifier.addDocument('P OUTOFEACHOF i', 'junk');
    classifier.addDocument('EEPOUT OF', 'junk');



    classifier.train();

    var formFin = null
    if(form != null){
      formFin = form[0]
    }
    var doseFin = null
    if(dosage != null){
      doseFin = dosage[0]
    }

    const medicine = []
    for(let j = 0; j < tokens.length; j++){
      console.log(tokens[j] + ": " + classifier.classify(tokens[j]));
      if(classifier.classify(tokens[j]) === "medicine"){
        var tokenFiltered = tokens[j].replace(/\d+/g,'').replace("Prolonged release", "").replace(formFin, '').replace(/[{()}]/g, '').replace(/  +/g, ' ').replace(/(?<=^|[^\w-])[\w-]{1,3}(?=[^\w-]|$)/g, "").replace(/-,/g, ' ').trim();
        if(tokenFiltered.replace(/\s+/g, '').length >= 4){
          var tempMed = tokenFiltered
          medicine.push(tempMed);
        }

      }
    }
    console.log(medicine)



    console.log(text[0][0])



    var nameFin = null
    var chemicalFin = null
    if(medicine.length >= 1){
      nameFin = medicine[0];
      if(medicine.length >= 2){
        var chem = medicine[1];
        chemicalFin = chem;
      }
    }

   var pillData = {
      Name: nameFin,
      Chemical: chemicalFin,
      Dosage: doseFin,
      Form: formFin,
    }
    data.push(pillData)
  }


  return data;
}

//Main executable code
(async () => {


  //preprocess image
  await processImage();

  //Read processed image from disk
  var img = require('fs').readFileSync('./mededited.png');

  //Load tensorflow model
  const model = new cvstfjs.ObjectDetectionModel();
  await model.loadModelAsync('file://model/model.json')

  //Put image into custom tensorflow object detection model
  const predictions = await model.executeAsync(img);
  console.log(predictions);
  
  //Scale coordinates
  const values = getCoords(predictions);
  console.log(values)

  //Read text from images using Tesseract
  var text = await imgToText(values)
  console.log(text)
  var data = await getDataFromText(text);
  console.log(data)


})();

//EFS
app.set('view engine', 'ejs')

// Public folder
app.use(express.static(__dirname + './public'))



// storage location for the images
const storage = multer.diskStorage({
    destination: function(req,file,cb) {
        cb(null, './uploads/images/')
    },

    filename: function(req,file,cb) {
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname))
    }
})

// Init Upload for a single file
const upload =  multer({
    storage: storage,
    limits:{fileize: 1024 * 1024 * 10},
    fileFilter: function(req, file,cb) {
        imageFilter(file, cb)
    } 
}).single('medImage')

    //Filter File types
const imageFilter = function(file, cb) {
    const filetypes = /jpeg|jpg|png|gif/;
    // Check ext
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    // Check mime
    const mimetype = filetypes.test(file.mimetype);
  
    if(mimetype && extname){
      return cb(null,true);
    } else {
      cb('Images Only');
    }
  
}

app.get("/", (req, res) => {
    res.render('index');
   });

   //upload post request 
app.post('/upload', (req, res) => {
    upload(req,res, (err) => {
        
        if(err) {
            res.render('index', {
            msg: err
        })

       }else{
           console.log(req.file)
           res.send(" File Uploaded")
       }

    })  
});


app.listen(3000, () => {

 console.log("Server running on port 3000");


})

