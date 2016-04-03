// import modules
var express = require('express');
var app = express();
var path = require('path');
var mongoose = require('mongoose');
var bodyParser = require('body-parser');

// connect database
mongoose.connect(process.env.MONGO_DB);
var db = mongoose.connection;
db.once("open",function () {
  console.log("DB connected!");
});
db.on("error",function (err) {
  console.log("DB ERROR :", err);
});

// model setting
var postSchema = mongoose.Schema({
  title: {type:String, required:true},
  body: {type:String, required:true},
  createdAt: {type:Date, default:Date.now},
  updatedAt: Date
});
var Post = mongoose.model('post',postSchema);
//model메서드에 첫번째 값은 모델=> req.body.name값,두번째는 스키마 형식이다.

// view setting
app.set("view engine", 'ejs');

// set middlewares
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());
//바디 파서를 제이슨형식으로
//set routes
app.get('/posts', function(req,res){
  Post.find({}, function (err,posts) {
    if(err) return res.json({success:false, message:err});
    //제이슨 형식으로 응답
    res.json({success:true, data:posts});
    //제이슨형식으로 응답
  });
}); // index
app.post('/posts', function(req,res){
  Post.create(req.body.post,function (err,post) {
    //데이터베이스에 데이터를 새로만든다. req.body.post를 결과 post
    if(err) return res.json({success:false, message:err});
    //응답한다 제이슨 형식으로
    //데이터베이스를 새로 만들면 id가 생성된다.(primary key)
    res.json({success:true, data:post});
    //응답한다 제이슨 형식으로
  });
});
app.get('/posts/:id', function(req,res){
  //생성된 id를 찾는다.
  Post.findById(req.params.id, function (err,post) {
    //데이터베이스에서 요청하는 id를 찾는다.(응답하는 id로 값을 넣었다.)
    if(err) return res.json({success:false, message:err});
    res.json({success:true, data:post});
    //success는 true로 ,data는 post값으로 json으로 응답한다
  });
}); // show

//put은 업데이트 db 업데이트 => findByIdAndUpdate
app.put('/posts/:id', function(req,res){
  req.body.post.updatedAt=Date.now();
  //값 수정
  Post.findByIdAndUpdate(req.params.id, req.body.post, function (err,post) {
    //찾는 id ,수정할 데이터, 실행
    if(err) return res.json({success:false, message:err});
    res.json({success:true, message:post._id+" updated"});
  });
}); //update
app.delete('/posts/:id', function(req,res){
  Post.findByIdAndRemove(req.params.id, function (err,post) {
    if(err) return res.json({success:false, message:err});
    res.json({success:true, message:post._id+" deleted"});
  });
}); //destroy
//start server
app.listen(3000,function(){
  console.log('running');
});
