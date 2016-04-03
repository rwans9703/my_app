var express = require('express');
var path = require('path');
var app= express();

app.use(express.static(path.join(__dirname,'public')));

// app.use(express.static(__dirname+'/public'));
// console.log(__dirname);
//__dirname 은 node에서 제공하는 node 파일경로를 담고있는 변수
app.get('/get',function(req,res){
res.send('hello');
});
app.listen(3000,function(){
  console.log('running');
});
