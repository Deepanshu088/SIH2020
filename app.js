//https://sih-twenty-app.herokuapp.com/
const express = require("express");
const http = require("http");
const ejs = require("ejs");
const bodyParser = require("body-parser");
require('dotenv').config();
const session = require("express-session");
// Twilio dependencies
const MessagingResponse = require('twilio').twiml.MessagingResponse;
const accountSid = 'AC0586991b03aa9d5200a431910f6d15ee';
const authToken = 'a4a987091514957ea96282dfac26258f';
const client = require('twilio')(accountSid, authToken);
//paypal dependencies
const paypal = require("paypal-rest-sdk");
var money=0;
//Firebase dependencies
const functions = require('firebase-functions');
const firebase = require("firebase");
var admin = require("firebase-admin");

firebase.initializeApp({
    apiKey: "AIzaSyDaIpqb5VS3GqjShEbb813I4ovkSzrV3IA",
    authDomain: "sih2020-de6fd.firebaseapp.com",
    databaseURL: "https://sih2020-de6fd.firebaseio.com",
    projectId: "sih2020-de6fd",
    storageBucket: "sih2020-de6fd.appspot.com",
    messagingSenderId: "991630094906",
    appId: "1:991630094906:web:f0e6b278a08d29c7013b03",
    measurementId: "G-J8S2D808HQ"
});
var database = firebase.database();

var userRef = database.ref("users");
var cropRef = database.ref("crops");
var transportQueryRef = database.ref("transportQueries");
var cartRef = database.ref("cart");

const app = express();
app.set("view engine","ejs");
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use("/",express.static(__dirname+"/views"));
app.use("/",express.static(__dirname+"/controllers"));
app.use("/",express.static(__dirname+"/public"));

const port = process.env.PORT || 1337;

//paypal bus config
paypal.configure({
    'mode': 'sandbox', //sandbox or live
    'client_id': 'AR7uBiiQvpL7VXPBn_-ir9JloBfZV7omyRNLmRCTiEhlVrrk3ik-1L_PUticbxOOtpp85NGgsl0ZrR3n',
    'client_secret': 'EPj_3zVf1R_A5R_xjIy50PsEZifRIRN83OMLAeurYWR7yRi4iOHSRLJXeptjIb-boYvb09v0mDAzSqTg'
});

app.use(session({
    secret : process.env.SESSEION_SECRET,
    saveUninitialized : true,
    resave : true,
    cookie : {
        maxAge : 1800000,
    }
}))

var message;

app.get("/",(req,res)=>{
    if(req.session.user){
        console.log("session is going on")
        res.redirect("/dashboard")
    } else {
        console.log("session is over")
        res.render("Home",{message:message});
        message="";
    }
}).post("/",(req,res)=>{
    switch(req.body.authBtn)
    {
        case "register" :       userRef.orderByChild("phoneNo").equalTo(req.body.phoneNo).once("value", function(data) {
                                    if(data.val()==null){
                                        console.log("User does not exists!!!!");
                                        userRef.push({
                                            name : req.body.name,
                                            phoneNo : req.body.phoneNo,
                                            email : req.body.email,
                                            password : req.body.password,
                                            address : req.body.address,
                                            userType : req.body.userType
                                        },(error)=> {
                                            if (error) {
                                                console.log('ooops');
                                                console.log(error.code);
                                                message= error.code;
                                                res.redirect("/");
                                            } else {
                                                console.log('data saved! now login on "/" ');
                                                message= "data saved";
                                                res.redirect("/");
                                            }
                                        })
                                    } else {
                                        console.log("User already exists!!!!");
                                        message = "number already registered";
                                        res.redirect("/");
                                    }
                                });                                    
                        break;
        case "login" :          userRef.orderByChild("phoneNo").equalTo(req.body.phoneNo).once("value", function(data) {
                                    console.log(data.val());
                                    if(data.val() == null){
                                        console.log("phoneNo is not valid phoneNo.");
                                        message = "number not registered";

                                        res.redirect("/");
                                    } 
                                });
                                userRef.orderByChild("phoneNo").equalTo(req.body.phoneNo).once("child_added", function(data) {
                                    if(data.val().phoneNo == req.body.phoneNo){
                                        console.log("PhoneNo exists");
                                        if(data.val().password == req.body.password){
                                            req.session.user = data.val();
                                            req.session.user.key = data.key;
                                            console.log(req.session.user);
                                            message = "Sucessfully Logged in";

                                            res.redirect("/");
                                        } else {
                                            console.log("incorrect password");
                                            message = "incorrect password";
                                            res.redirect("/");
                                        }
                                    }
                                }); 
                        break;
        case "signout" :        req.session.destroy();
                                message = "Sign Out";
                                res.redirect("/");

                        break;
    }    
});

app.get("/farmers",(req,res)=>{
    if(req.session.user && (req.session.user.userType=="farmer")){
        
        cropRef.orderByChild("cropOwner").equalTo(req.session.user.key).once("value",function(data){ 
            res.render("farmers",{docs : data,message:message});
            message="";
        })
    } else {
        res.redirect("/dashboard");
    }
}).post("/farmers",(req,res)=>{
    var currentUserCropRef = userRef.child(req.session.user.key).child("crops");
    switch(req.body.farmerCrop)
    {
        case "addNewCrop" : currentUserCropRef.orderByChild("cropName").equalTo(req.body.cropName).once("value",function(data){
                                if(data.val()==null){
                                    console.log("the crop is new crop")
                                    var x = cropRef.push({
                                                cropName : req.body.cropName,
                                                minQuantity : req.body.minQuantity,
                                                category : req.body.category,
                                                quantity : req.body.quantity,
                                                price : req.body.price,
                                                cropOwner : req.session.user.key
                                            }, function(error){
                                                if(error){
                                                    console.log("error" + error);
                                                    message=error.code;
                                                    res.redirect("/farmers");
                                                } else {
                                                    console.log("new crop added to 'crops' link")
                                                    message="New Crop Added to crop Ref";
                                                }
                                            }).key;
                                    currentUserCropRef.push({
                                        cropName : req.body.cropName,
                                        cropId : x
                                    }, function(error){
                                        if(error){
                                            console.log("error" + error);
                                            message=error.code;
                                        } else {
                                            console.log("new crop added farmer's data")
                                            message="Successfully Added";
                                        }
                                    })
                                    res.redirect("/farmers");
                                } else {
                                    console.log("this type of crop is already added, you can only update this");
                                    message="You already have this crop.";
                                    res.redirect("/farmers");
                                }
                            })
                        break;

        case "updateCrop" : currentUserCropRef.orderByChild("cropName").equalTo(req.body.cropName).once("child_added",function(data){
                                console.log(data.val().cropName);
                                if(data.val()==null){
                                    console.log("there is no such crop");
                                    res.redirect("/farmers");
                                } else { 
                                    cropRef.child(data.val().cropId).update({
                                        minQuantity : req.body.minQuantity,
                                        quantity : req.body.quantity,
                                        price : req.body.price,                    
                                    }, function(error){
                                        if(error){
                                            console.log("hey there is an error in updating crops");
                                            message=error.code;
                                            res.redirect("/farmers");
                                        } else {
                                            console.log("updated successfully");
                                            message="Updated Successfully";
                                            res.redirect("/farmers");
                                        }
                                    })
                                }
                            })
                        break;

        case "deleteCrop" : currentUserCropRef.orderByChild("cropName").equalTo(req.body.cropName).once("child_added",function(data){
                                if(data.val()==null){
                                    console.log("there is no such crop");
                                    res.redirect("/farmers");
                                } else {
                                    console.log(data.key);
                                    cropRef.child(data.val().cropId).remove(function(error){
                                        if(error){
                                            console.log("hey there is an error in deleting crops");
                                            message=error.code;
                                        } else {
                                            console.log("deleted successfully from 'crops' ");
                                            message="Crop has been deleted successfully ";
                                        }
                                        res.redirect("/farmers");
                                    }).then(()=>{
                                        currentUserCropRef.child(data.key).remove();
                                        console.log('deleted from farmer')
                                        message="Crop has been deleted from farmers data";
                                        res.redirect("/farmers");
                                    })
                                }
                            })
                        break;
        case "addTransportQuery" :  var x = transportQueryRef.push({
                                            pickLoc : req.body.pickLoc,
                                            dropLoc : req.body.dropLoc,
                                            price : req.body.expPrice,
                                            queryOwner : req.session.user.key
                                        },function(error){
                                            if(error){
                                                console.log("error" + error);
                                                message=error.code;
                                                res.redirect("/farmers")
                                            } else {
                                                console.log("new query added to 'tansportQueries' link")
                                                message="New Transport Query has been added";
                                            }
                                        }).key;
                                        userRef.child(req.session.user.key).child("queries").push({queryId : x}, function(error){
                                            if(error){
                                                console.log("error" + error);
                                                message=error.code;
                                            } else {
                                                console.log("new crop added user's data")
                                                message="New Transport Query Added";
                                            }
                                            res.redirect("/farmers");
                                        })
                        break;
    }
});

app.get("/farmer/bids",(req,res)=>{
    
    if(req.session.user && (req.session.user.userType=="farmer")){
        var xyz = [];
        userRef.child(req.session.user.key).child('bids').once("value", function(data){
            if(data.val()==null){
                message='There are no bids on your crop';
                res.render("farmerBids",{doc:xyz,message:message});
                message="";
            } else{
                console.log("data is not null")
                data.forEach(function(docs){
                    var buyerId = docs.val().buyerId;
                    var bidId = docs.val().bidId;
                    var cropId = docs.val().cropId;
                    userRef.child(buyerId).child("bids").child(bidId).once("value",function(doc){
                        xyz.push(doc.val());
                        if(xyz.length==data.numChildren()){
                            console.log(xyz)
                            res.render("farmerBids",{doc:xyz,message:message});
                            message="";
                        }
                    })
                })
            }
        }).catch((error)=>{
            if(error){
                console.log("error");
                console.log(error);
                res.redirect("/farmer/bids");
            }
        })
    } else {
        res.redirect("/dashboard");
    }
})


app.get("/buyer",(req,res)=>{
    if(req.session.user && (req.session.user.userType=="buyer")){
        userRef.child(req.session.user.key).child('bids').orderByChild("cropId").once("value",function(data){                    
            res.render("bids",{docs:data,message:message});
            message=""
        })
    } else {
        res.redirect("/dashboard");
    }
}).post("/buyer",(req,res)=>{
    var currentUserdemandRef = userRef.child(req.session.user.key).child("demands");
    switch(req.body.buyerAction)
    {   case "addTransportQuery" :  var x = transportQueryRef.push({
                                        pickLoc : req.body.pickLoc,
                                        dropLoc : req.body.dropLoc,
                                        price : req.body.expPrice,
                                        queryOwner : req.session.user.key
                                    },function(error){
                                        if(error){
                                            console.log("error" + error);
                                            message=error.code;
                                            res.redirect("/farmers")
                                        } else {
                                            console.log("new query added to 'tansportQueries' link")
                                            message="Transport query added";
                                        }
                                    }).key;
                                    userRef.child(req.session.user.key).child("queries").push({queryId : x}, function(error){
                                        if(error){
                                            console.log("error" + error);
                                            message=error.code;
                                            
                                        } else {
                                            console.log("new crop added user's data")
                                            message="New transport added to users data";
                                        }
                                        res.redirect("/farmers");
                                    })
                            break;
    }
});

app.get("/buyer/crops",(req,res)=>{
    if(req.session.user && (req.session.user.userType=="buyer")){
        cropRef.orderByChild("price").once("value",function(data){ 
            res.render("farmerCrops",{docs : data,message:message});
            message=""
        })
    } else {
        res.redirect("/dashboard");
    }
}).post("/buyer/crops",(req,res)=>{
    var currentUserBidRef = userRef.child(req.session.user.key);
    console.log(req.body.cropId);

    switch(req.body.buyerAction){
        case "bid" :    
                        console.log(req.body.cropId);

                        var x = currentUserBidRef.child('bids').push({
                            cropId : req.body.cropId,
                            cropOwner: req.body.cropOwner,
                            offerQuantity : req.body.offerQuantity,
                            offerPrice : req.body.offerPrice,
                            actualPrice : req.body.price,
                            cropName : req.body.cropName,
                        },function(error){
                            if(error){
                                console.log("error" + error.code);
                                message=error.code;
                                res.redirect('/buyer/crops')
                            }
                        }).key
                        console.log(req.body.cropOwner);
                        userRef.child(req.body.cropOwner).child("bids").push({
                            cropId : req.body.cropId,
                            buyerId : req.session.user.key,
                            bidId : x,
                        })
                        cropRef.child(req.body.cropId).push({
                            buyerId : req.session.user.key
                        })
                        message="New Bid added";
                        res.redirect("/buyer");
                    break;
        case "addToCart" :  cartRef.orderByChild("buyerId").equalTo(req.session.user.key).once("value", function (data) {
                                if(data.val()==null){
                                    cartRef.push({
                                        minQuantity : req.body.minQuantity,
                                        avialableQuantity : req.body.quantity,
                                        cropId : req.body.cropId,
                                        cropOwner: req.body.cropOwner,
                                        price : req.body.price,
                                        cropName : req.body.cropName,
                                        buyerId :  req.session.user.key,
                                        buyQuantity : req.body.offerQuantity,
                                        category: req.body.category,
                                        transactionStatus : false
                                    },function(error){
                                        if(error){
                                            console.log("error" + error.code);
                                            message=error.code;
                                            res.redirect('/buyer/crops');
                                        } else {
                                            console.log("new crop added to cart")
                                            message="Crop is added to cart";
                                            res.redirect("/cart");
                                        }
                                    })
                                } else{
                                    data.forEach(function(docs){
                                        if(docs.val().cropId==req.body.cropId){
                                            console.log("You have already added this crop in the cart");
                                            res.redirect("/buyer/crops")
                                        } else{
                                            cartRef.push({
                                                minQuantity : req.body.minQuantity,
                                                avialableQuantity : req.body.quantity,
                                                cropId : req.body.cropId,
                                                cropOwner: req.body.cropOwner,
                                                price : req.body.price,
                                                cropName : req.body.cropName,
                                                buyerId :  req.session.user.key,
                                                category: req.body.category,
                                                buyQuantity : req.body.offerQuantity,
                                                transactionStatus : false
                                            },function(error){
                                                if(error){
                                                    console.log("error" + error.code);
                                                    message=error.code;
                                                    res.redirect('/buyer/crops');
                                                } else {
                                                    console.log("new crop added to cart")
                                                    message="Crop is added to cart";
                                                    res.redirect("/cart");
                                                }
                                            })
                                        }
                                    })
                                }
                            })
            break;
    }
})

app.get("/transportAgent",(req,res)=>{
    if(req.session.user && (req.session.user.userType=="transportAgent")){
        res.render("transportAgent",{message:message});
        message="";
    } else {
        res.redirect("/");
    }
}).post("/transportAgent",(req,res)=>{
    res.render("transportAgent");
});

app.get("/dashboard",(req,res)=>{
    if(req.session.user){
        if(req.session.user.userType=="farmer"){
            link="farmers";
            link2="farmer/bids"
            link3="Bids on your Crop"
            link4=""
            link5=""
        } else if(req.session.user.userType=="buyer"){
            link="buyer";
            link2="buyer/crops"
            link3="Crops"            
            link4="cart"
            link5="Cart"
        } else if(req.session.user.userType=="transportAgent"){
            link="transportAgent"
        }
        res.render("dashboard",{link:link, link2:link2, link3:link3, link4:link4, link5:link5, docs:req.session.user,message:message});
        message="";
    } else {
        res.redirect("/");
    }
}).post("/dashboard",(req,res)=>{
    if(req.body.abcd =='signOut'){
        req.session.destroy();
        message="Logout successful"
        res.redirect("/");
    }
})

app.get("/cart",(req,res)=>{
    var totalMoney=0;
    var quantity,price;
    if(req.session.user && (req.session.user.userType=="buyer")){
        cartRef.orderByChild("buyerId").equalTo(req.session.user.key).once("value",function(data){
            data.forEach(function(docs){
                quantity = docs.val().buyQuantity;
                price = docs.val().price;
                totalMoney = totalMoney + quantity*price;
                console.log(quantity);
                console.log(price);
                console.log(totalMoney);
                money = totalMoney;
            })
            res.render("cart",{totalMoney:totalMoney,docs:data,message:message});
            message="";
        })
    } else {
        res.redirect("/");
    }
}).post("/cart",(req,res)=>{
    switch(req.body.cart){
        case "update" : cartRef.child(req.body.cartId).update({
                            buyQuantity:req.body.quantity,
                        }, function(error){
                            if(error){
                                console.log("hey there is an error in updating cart crop");
                                message=error.code;
                                res.redirect("/cart");
                            } else {
                                console.log("updated successfully");
                                message="Updated Successfully";
                                res.redirect("/cart");
                            }
                        });
            break;
        case "buy" :    console.log("hi")
                        const create_payment_json = {
                            "intent": "sale",
                            "payer": {
                                "payment_method": "paypal"
                            },
                            "redirect_urls": {
                                "return_url": "https://1a6625d8.ngrok.io/success",
                                "cancel_url": "https://1a6625d8.ngrok.io/cart"
                            },
                            "transactions": [{
                                "item_list": {
                                    "items": [{
                                        "name": "One Piece Figure Store",
                                        "sku": "001",
                                        "price": money,
                                        "currency": "USD",
                                        "quantity": 1
                                    }]
                                },
                                "amount": {
                                    "currency": "USD",
                                    "total": money
                                },
                                "description": "Luffy decoration figure for One piece Fans."
                            }]
                        };
                        paypal.payment.create(create_payment_json, function (error, payment) {
                            if (error) {
                                throw error;
                                message= error.code;
                                res.redirect("/cart");
                            } else {
                                for(let i=0; i < payment.links.length;i++){
                                    if(payment.links[i].rel==='approval_url'){
                                        res.redirect(payment.links[i].href);
                                    }
                                }
                            }
                        });
            break;
    }
    
})
app.get("/success",(req,res)=>{
    const payerId = req.query.PayerID;
    const paymentId = req.query.paymentId;

    const execute_payment_json = {
        "payer_id": payerId,
        "transactions": [{
            "amount": {
                "currency": "USD",
                "total": money
            }
        }]
    };
    paypal.payment.execute(paymentId, execute_payment_json, function (error, payment) {
        if (error) {
            console.log(error.response);
            throw error;
        } else {
            console.log("Get Payment Response");
            console.log(JSON.stringify(payment));
        }
    });
    message="Payment Successful";
money=0;
res.redirect("/buyer");
})
app.get("/failure",(req,res)=>{
    res.send("failed!!!");
    money=0;
    message="payment failed";
    res.redirect("/");
})

app.get("/sms",(req,res)=>{
    res.render("sms",{message:message});
})
// Hello my name is # hey there dude ho# how are you  mn #oh yeah i love it
app.post("/sms",(req,res)=>{
    var smsRespond = 'Hey We have recieved your message jbuxzgeueuvzx';
    console.log("post runs /sms");
    console.log(req.body);
    console.log(req.body.Body);
    const twiml = new MessagingResponse();
    var body = req.body.Body;
    // const body = req.body.sms;
    var phoneNo,farmerId,password;
    var b = body.split('#');
    switch(b[0]){
        case "Register" :   console.log("Register");
                            var userType = b[1];
                            var name = b[2];
                            phoneNo = b[3];
                            var address = b[4];
                            password = b[5];
                            userRef.orderByChild("phoneNo").equalTo(phoneNo).once("value",function(data){
                                if(data.val()==null){
                                    userRef.push({
                                        name:name,
                                        phoneNo:phoneNo,
                                        address:address,
                                        userType:userType,
                                        password:password
                                    },function(error){
                                        if(error){
                                            console.log(error.code)
                                        } else{
                                            console.log("User added successfully")
                                            smsRespond="User added Successfully"
                                        }
                                    })
                                } else{
                                    console.log("this number is already registered");
                                    smsRespond="This Number is already registered"
                                }
                            })
                        break;
        case "Crop":    console.log("Crop");
                        var flag = false;
                        var category = b[1];
                        var cropName = b[2];
                        var minQuantity = b[3];
                        var quantity = b[4];
                        var cropPrice = b[5];
                        phoneNo = b[6];
                        password = b[7];
                        console.log(phoneNo)
                        userRef.orderByChild("phoneNo").equalTo(phoneNo).once("value",function(data){
                            data.forEach(function(docs){
                                farmerId = docs.key;
                            })
                            cropRef.orderByChild("cropOwner").equalTo(farmerId).once("value",function(info){
                                info.forEach(function(docs){
                                    if(docs.val().cropName==cropName){
                                        flag = true;
                                        console.log("crop Exist");
                                        if((quantity==0)||(quantity=="0")){
                                            console.log("delete");
                                            cropRef.child(docs.val().cropId).remove(function(error){
                                                if(error){
                                                    console.log("hey there is an error in deleting crops");
                                                    smsRespond=error.code;
                                                } else {
                                                    console.log("deleted successfully from 'crops' ");
                                                    smsRespond="Crop has been deleted successfully ";
                                                }
                                            }).then(()=>{
                                                userRef.child(farmerId).child("crops").child(docs.key).remove();
                                                console.log('deleted from farmer')
                                                smsRespond="Crop has been deleted from farmers data";
                                            })
                                        } else {
                                            console.log('update');
                                            cropRef.child(docs.val().cropId).update({
                                                minQuantity : minQuantity,
                                                quantity : quantity,
                                                price : cropPrice,                    
                                            }, function(error){
                                                if(error){
                                                    console.log("hey there is an error in updating crops");
                                                    smsRespond=error.code;
                                                } else {
                                                    console.log("updated successfully");
                                                    smsRespond="Updated Successfully";
                                                }
                                            })
                                        }
                                    }
                                })
                                if(flag==false){
                                    console.log("Add new Crop");
                                    var x = cropRef.push({
                                        cropName : cropName,
                                        minQuantity : minQuantity,
                                        category : category,
                                        quantity : quantity,
                                        price : cropPrice,
                                        cropOwner : farmerId
                                    }, function(error){
                                        if(error){
                                            console.log("error" + error);
                                            smsRespond=error.code;
                                        } else {
                                            console.log("new crop added to 'crops' link")
                                            smsRespond="New Crop Added to crop Ref";
                                        }
                                    }).key;
                                    userRef.child(farmerId).child("crops").push({
                                        cropName : cropName,
                                        cropId : x
                                    }, function(error){
                                        if(error){
                                            console.log("error" + error);
                                            smsRespond=error.code;
                                        } else {
                                            console.log("new crop added farmer's data")
                                            smsRespond="Successfully Added";
                                        }
                                    })
                                }
                            })
                        })                        
            break;
        default :   console.log("Wrong command");
                    smsRespond="Wrong Command for register Register#userType#Name#PhoneNo#Address#Password  for crop query Crop#Category#CropName#MinQuantity#Quantity#CropPrice#PhoneNo#Password";
            break;
    }
   setTimeout(function(){
    console.log("run");
    console.log(smsRespond);
    twiml.message(smsRespond);
    console.log(twiml.message);
    res.writeHead(200, {'Content-Type': 'text/xml'});
    res.end(twiml.toString());
    console.log(twiml.toString());
   },10000);
})


app.listen(port,()=>{
    console.log("server is running at "+ port);
});
// http.createServer(app).listen(port, () => {
//     console.log('Express server listening on port '+ port);
//   });

// exports.app = functions.https.onRequest(app);