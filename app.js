// import modules
var express = require('express');
var app = express();
var path = require('path');
var mongoose = require('mongoose');
var bodyParser = require('body-parser');
var methodOverride = require('method-override');
var passport = require('passport');
var session = require('express-session');
var flash = require('connect-flash');
var async = require('async');
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

var userSchema = mongoose.Schema({
  email:{type:String,required:true,unique:true},
  //unique는 다른 데이터와 비교하여 있다면 에러를 보낸다.
  nickname:{type:String,required:true,unique:true},
  password:{type:String,required:true},
  createdAt:{type:Date,default:Date.now()}
});
var User = mongoose.model('user',userSchema);
//model메서드에 첫번째 값은 모델=> req.body.name값,두번째는 스키마 형식이다.

// view setting
app.set("view engine", 'ejs');

// set middlewares
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({extended:true}));
app.use(methodOverride('_method'));
app.use(flash());

app.use(session({secret:'MySecret'}));
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser(function(user,err){
    done(null,user.id);
});
passport.deserializeUser(function(id,done){
  User.findById(id,function(err,user){
    done(err,user);
  });
});
var LocalStrategy = require('passport-local').Strategy;
passport.use('local-login',
  new LocalStrategy({
    usernameField:'email',//데이터베이스 필드에 값을 읽는다.
    passwordField:'password',
    passReqToCallback:true
  },
  function(req,email,password,done){
    //요청하면 어떻게 할건지
    User.findOne({'email':email},function(err,user){
      if(err) return done(err);

      if(!user){
        req.flash('email',req.body.email);
        return done(null,false,req.flash('loginError','No user found.'));
      }
      if(user.password != password){
        req.flash('email',req.body.email);
        return done(null,false,req.flash('loginError','Passsword does not Match.'));
      }
      return done(null,user);
    });
  }
)
);
//바디 파서를 제이슨형식으로
//set routes
app.get('/',function(req,res){
  res.redirect('/posts');
});
app.get('/login',function(req,res){
  res.render('login/login',{email:req.flash("email")[0],loginError:req.flash('loginError')});
});
app.post('/login',
  function(req,res,next){
    req.flash('email');
    if(req.body.email.length === 0 || req.body.password.length ===0){
      req.flash('email',req.body.email);
      req.flash('loginError',"Please enter both email and password");
      res.redirect('/login');
    }else{
      next();
    }
  }, passport.authenticate('local-login',{
    successRedirect : '/posts',
    failureRedirect : '/login',
    failureFlash : true
  })
);
app.get('/logout',function(req,res){
  req.logout();//로그아웃한다.
  res.redirect('/');
});

app.get('/users/new',function(req,res){
  res.render('users/new',{
    formData:req.flash('formData')[0],
    emailError:req.flash('emailError')[0],
    nicknameError:req.flash('nicknameError')[0],
    passwordError:req.flash('passwordError')[0]
  });
});//new
app.post('/users',checkUserRegValidation,function(req,res,next){
      //checkUserRegValidation는 email과 nickname이 겹치는지 알려주는 함수
  User.create(req.body.user,function(err,user){
    if(err) return res.json({success:false,message:err});
    res.redirect('/login');
  });
});//create
app.get('/users/:id',function(req,res){
  User.findById(req.params.id,function(err,user){
    if(err) return res.json({success:false,message:err});
    res.redirect('/login');
  });
});//show
app.get('/users/:id/edit',function(req,res){
  User.findById(req.params.id,function(err,user){
  res.render('user/edit',{
    user:user,
    formData:req.flash('formData')[0],
    emailError:req.flash('emailError')[0],
    nicknameError:req.flash('nicknameError')[0],
    passwordError:req.flash("passwordError")[0]
  });
  });
});
app.put('/users/:id',function(req,res){
  User.findById(req.params.id,req.body.user,function(err,user){
    if(err) return res.json({success:false,message:err});
    if(req.body.user.password == user.password){
      if(req.body.user.newPassword){
        req.body.user.password=req.body.user.newPassword;
    }else{
      delete req.body.password;
    }
    User.findByIdAndUpdate(req.params.id,req.body.user,function(err,user){
      if(err) return res.json({success:false,message:err});
      res.redirect('/users/'+req.params.id);
    });

  }else{
    req.flash('formData',req.body.user);
    req.flash('passwordError','- Invalid password');
    res.redirect('/users/'+req.params.id+'/edit');
  }
  });
});//update
//set posts routes
app.get('/posts',function(req,res){
  Post.find({}).sort('-createdAt').exec(function(err,posts){
    if(err) return res.json({success:false,message:err});
    res.render('posts/index',{data:posts,user:req.user});
  });
});
app.get('/users/:id',function(req,res){
  User.findById(req.params.id,function(err,user){
    if(err) return res.json({success:false,message:err});
    res.render('users/show',{user:user});
  });
});
app.get('/posts', function(req,res){
  Post.find({}).sort('createdAt').exec(function(err,posts){
    if(err) return res.json({success:false, message:err});
    res.render('posts/index', {data:posts});
  });    //제이슨형식으로 응답
}); // index
app.post('/posts', function(req,res){
  Post.create(req.body.post,function (err,post) {
    //데이터베이스에 데이터를 새로만든다. req.body.post를 결과 post
    if(err) return res.json({success:false, message:err});
    //응답한다 제이슨 형식으로
    //데이터베이스를 새로 만들면 id가 생성된다.(primary key)
    res.redirect('/posts');
    //응답한다 제이슨 형식으로
  });
});
app.get('/posts/new',function(req,res){
  res.render('posts/new');
});
app.get('/posts/:id', function(req,res){
  //생성된 id를 찾는다.
  Post.findById(req.params.id, function (err,post) {
    //데이터베이스에서 요청하는 id를 찾는다.(응답하는 id로 값을 넣었다.)
    if(err) return res.json({success:false, message:err});
    res.render('posts/show',{data:post});
    //success는 true로 ,data는 post값으로 json으로 응답한다
  });
}); // show
app.get('/posts/:id/edit',function(req,res){
  Post.findById(req.params.id,function(err,post){
    if(err) return res.json({success:false,message:err});
    res.render('posts/edit',{data:post});
  });
});
//put은 업데이트 db 업데이트 => findByIdAndUpdate
app.put('/posts/:id', function(req,res){
  req.body.post.updatedAt=Date.now();
  //값 수정
  Post.findByIdAndUpdate(req.params.id, req.body.post, function (err,post) {
    //찾는 id ,수정할 데이터, 실행
    if(err) return res.json({success:false, message:err});
    res.redirect('/posts/'+req.params.id);
  });
}); //update
app.delete('/posts/:id', function(req,res){
  Post.findByIdAndRemove(req.params.id, function (err,post) {
    if(err) return res.json({success:false, message:err});
    res.redirect('/posts');
  });
}); //destroy

function checkUserRegValidation(req,res,next){
  var isValid = true;

  async.waterfall(
    [function(callback){
      User.findOne({email:req.body.user.email,_id:{$ne:mongoose.Types.ObjectId(req.paramsid)}},
        function(err,user){
          if(user){
            isValid =false;
            req.flash('emailError','- This email is already resistered.');
          }
          callback(null,isValid);
        }
      );
    },function(isValid,callback){
      User.findOne({nickname:req.body.user.nickname, _id: {$ne:mongoose.Types.ObjectId(req.params.id)}},
      function(err,user){
        if(user){
          isValid=false;
          req.flash('nicknameError','This nickname is already resistered.');
        }
        callback(null,isValid);
      }
    );
  }], function(err,isValid){
    if(err) return res.json({success:'false',message:err});
    if(isValid){
      return next();
    }else{
      req.flash('formData',req.body.user);
      res.redirect('back');
    }
  }
);
}
//start server
app.listen(3000,function(){
  console.log('running');
});
