// import modules
var express  = require('express');
var app      = express();
var path     = require('path');
var mongoose = require('mongoose');
var passport = require('passport');
var session  = require('express-session');
var flash    = require('connect-flash');
var async    = require('async');
var bodyParser     = require('body-parser');
var methodOverride = require('method-override');
var bcrypt = require('bcrypt-nodejs');
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
  author:{type:mongoose.Schema.Types.ObjectId, ref:'user',required:true},
  // _id는 단순한 문자열이 아닙니다. _id를 담기 위해서는 mongoose.Schema.Tyopes.ObjectId로 표시해야
  //ref:'user'를 통해 이항목이 user collection을 가르키고 있습니다.

  createdAt: {type:Date, default:Date.now},
  updatedAt: Date
});
var Post = mongoose.model('post',postSchema);

var userSchema = mongoose.Schema({
  email: {type:String, required:true, unique:true},
  nickname: {type:String, required:true, unique:true},
  password: {type:String, required:true},
  createdAt: {type:Date, default:Date.now}
});
userSchema.pre('save',function(next){
  //pre => ~하기전 save 메서드를 실행하기전 (save메서드가 없지만 user.create메서드를 실행하면 save메서드도실행된다.)
  var user = this;
  if(!user.isModified("password")){
    //db에 저장된값과 비교하여 변화가 없다면
    return next();
  }else{
    //db에 변화가 있다면
    //새로만든다.
    user.password=bcrypt.hashSync('user.password');
    //해쉬코드로 동기적으로 만든다.
    return next();
  }
});
userSchema.methods.authenticate = function (password){
  var user = this;
  return bcrypt.compareSync(password,user.password);
  //동기적으로 해쉬코드값을 비교한다.
};
var User = mongoose.model('user',userSchema);

// view setting
app.set("view engine", 'ejs');

// set middlewares
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended:true}));
app.use(methodOverride("_method"));
app.use(flash());

app.use(session({secret:'MySecret'}));
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser(function(user, done) {
  done(null, user.id);
});
passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});

var LocalStrategy = require('passport-local').Strategy;
passport.use('local-login',
  new LocalStrategy({
      usernameField : 'email',
      passwordField : 'password',
      passReqToCallback : true
    },
    function(req, email, password, done) {
      User.findOne({ 'email' :  email }, function(err, user) {
        if (err) return done(err);

        if (!user){
            req.flash("email", req.body.email);
            return done(null, false, req.flash('loginError', 'No user found.'));
        }
        if (user.authenticate(password)){
            req.flash("email", req.body.email);
            return done(null, false, req.flash('loginError', 'Password does not Match.'));
        }
        return done(null, user);
      });
    }
  )
);

// set home routes
app.get('/', function (req,res) {
  res.redirect('/posts');
});
app.get('/login', function (req,res) {
  res.render('login/login',{email:req.flash("email")[0], loginError:req.flash('loginError')});
});
app.post('/login',
  function (req,res,next){
    req.flash("email"); // flush email data
    if(req.body.email.length === 0 || req.body.password.length === 0){
      req.flash("email", req.body.email);
      req.flash("loginError","Please enter both email and password.");
      res.redirect('/login');
    } else {
      next();
    }
  }, passport.authenticate('local-login', {
    successRedirect : '/posts',
    failureRedirect : '/login',
    failureFlash : true
  })
);
app.get('/logout', function(req, res) {
    req.logout();
    res.redirect('/');
});

// set user routes
app.get('/users/new', function(req,res){
  res.render('users/new', {
                            formData: req.flash('formData')[0],
                            emailError: req.flash('emailError')[0],
                            nicknameError: req.flash('nicknameError')[0],
                            passwordError: req.flash('passwordError')[0]
                          }
  );
}); // new
app.post('/users', checkUserRegValidation, function(req,res,next){
  User.create(req.body.user, function (err,user) {
    if(err) return res.json({success:false, message:err});
    res.redirect('/login');
  });
}); // create
app.get('/users/:id',isLoggedIn, function(req,res){
    User.findById(req.params.id, function (err,user) {
      if(err) return res.json({success:false, message:err});
      res.render("users/show", {user: user});
    });
}); // show
app.get('/users/:id/edit',isLoggedIn, function(req,res){
  if(req.user._id != req.params.id) return res.json({success:false,message:"Unauthrized Attempt"});
  //현재 요청아디이 페이지와 요청아이디가 같지않다면 에러를 발생
  User.findById(req.params.id, function (err,user) {
    if(err) return res.json({success:false, message:err});
    res.render("users/edit", {
                              user: user,
                              formData: req.flash('formData')[0],
                              emailError: req.flash('emailError')[0],
                              nicknameError: req.flash('nicknameError')[0],
                              passwordError: req.flash('passwordError')[0]
                             }
    );
  });
}); // edit
app.put('/users/:id',isLoggedIn, checkUserRegValidation, function(req,res){
  //next를 사용하는이유는 로그인 되었다면 들어갈수있도록 특정 조건이 성립할때만 들어갈수있도록 하기위함이다.
  if(req.user._id != req.params.id) return res.json({success:false,message:"Unauthrized Attempt"});
  User.findById(req.params.id, req.body.user, function (err,user) {
    if(err) return res.json({success:"false", message:err});
    if(user.authenticate(req.body.user.password)){
      //authenticate user개체에있는 해쉬코드와 비교한다.
      if(req.body.user.newPassword){
        user.password=req.body.user.newPassword;
        user.save();
        //저장하기전에 해쉬코드화 해버린다.
      } else {
        delete req.body.user.password;
      }
      User.findByIdAndUpdate(req.params.id, req.body.user, function (err,user) {
        if(err) return res.json({success:"false", message:err});
        res.redirect('/users/'+req.params.id);
      });
    } else {
      req.flash("formData", req.body.user);
      req.flash("passwordError", "- Invalid password");
      res.redirect('/users/'+req.params.id+"/edit");
    }
  });
}); //update

// set posts routes
app.get('/posts', function(req,res){
  Post.find({}).populate('author').sort('-createdAt').exec(function (err,posts) {
    //populate는 user object(ref)인 author를 치환합니다.(ref가 있어야하는 이유)
    if(err) return res.json({success:false, message:err});
    res.render("posts/index", {data:posts, user:req.user});
  });
}); // index
app.get('/posts/new',isLoggedIn, function(req,res){
  res.render("posts/new",{user:req.user});
}); // new
app.post('/posts',isLoggedIn, function(req,res){
  //isLoggedIn=> 로그인이라면 들어올수있도록
  //물론 비로그인자의 글 작성을 위해 req.user를 null체크해서 따로 기능을 추가할 수도 있습니다.
  req.body.post.author=req.user._id;
  Post.create(req.body.post,function (err,post) {
    if(err) return res.json({success:false, message:err});
    res.redirect('/posts');
  });
}); // create
app.get('/posts/:id', function(req,res){
  Post.findById(req.params.id).populate('author').exec(function (err,post) {
    if(err) return res.json({success:false, message:err});
    res.render("posts/show", {data:post,user:req.user});
  });
}); // show
app.get('/posts/:id/edit',isLoggedIn, function(req,res){
  Post.findById(req.params.id, function (err,post) {
    if(err) return res.json({success:false, message:err});
    if(!req.user._id.equals(post.author)) return res.json({success:false,message:"Unauthrized Attempt"});
    res.render("posts/edit", {data:post,user:req.user});
  });
}); // edit
app.put('/posts/:id',isLoggedIn, function(req,res){
  req.body.post.updatedAt=Date.now();
  Post.findById(req.params.id,function (err,post) {
    if(err) return res.json({success:false, message:err});
    if(!req.user._id.equals(post.author)) return res.json({success:false,message:"Unauthrized Attempt"});
    //만약 아이디가 아니라면 에러를 발생
    //계정에 아이디를 확인후 일치하면 수정 가능하게 한다.
    Post.findByIdAndUpdate(req.params.id,req.body.post,function(err,post){
      if(err) return res.json({success:false,message:err});
      res.redirect('/posts/'+req.params.id);
    });
    res.redirect('/posts/'+req.params.id);
  });
}); //update
app.delete('/posts/:id', function(req,res){
  Post.findById(req.params.id,function(err,post){
    if(err) return res.json({success:false,message:err});
    if(!req.user._id.equals(post.author)) return res.json({success:false,message:"Unauthrized Attempt"});
    //_id는 문자열이 아닌 오브젝트이다. 그래서 비교를 equals메서드로 비교한다.
    Post.findByIdAndRemove(req.params.id, function (err,post) {
      if(err) return res.json({success:false, message:err});
      res.redirect('/posts');
    });
  });
}); //destroy
function isLoggedIn(req,res,next){
  if(req.isAuthenticated()){
    return next();
    //로그인 되었다면 다음함수로
  }
  res.redirect('/');
  //로그인 안됬다면 시작화면
}
//isLoggedIn메서드는 isAuthenticated를 사용하여 현재 로그인 상태인지를 나타낸다.
//functions
function checkUserRegValidation(req, res, next) {
  var isValid = true;

  async.waterfall(
    [function(callback) {
      User.findOne({email: req.body.user.email, _id: {$ne: mongoose.Types.ObjectId(req.params.id)}},
        function(err,user){
          if(user){
            isValid = false;
            req.flash("emailError","- This email is already resistered.");
          }
          callback(null, isValid);
        }
      );
    }, function(isValid, callback) {
      User.findOne({nickname: req.body.user.nickname, _id: {$ne: mongoose.Types.ObjectId(req.params.id)}},
        function(err,user){
          if(user){
            isValid = false;
            req.flash("nicknameError","- This nickname is already resistered.");
          }
          callback(null, isValid);
        }
      );
    }], function(err, isValid) {
      if(err) return res.json({success:"false", message:err});
      if(isValid){
        return next();
      } else {
        req.flash("formData",req.body.user);
        res.redirect("back");
      }
    }
  );
}

// start server
app.listen(3000, function(){
  console.log('Server On!');
});
