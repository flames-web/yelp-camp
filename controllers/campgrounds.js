const Campground = require('../models/campground');
const mbxGeocoding = require("@mapbox/mapbox-sdk/services/geocoding");
const mapBoxToken = process.env.MAPBOX_TOKEN;
const geocoder = mbxGeocoding({ accessToken: mapBoxToken });
const {cloudinary} = require('../cloudinary');

module.exports.index = async (req,res) => {
    const perPage = 8;
    let page = parseInt(req.query.page);
    const campgrounds = await Campground.find({}).sort('-createdAt').skip(perPage * page - perPage).limit(perPage);
    const count = await Campground.count();
    res.render('campgrounds/index',{campgrounds,pages: Math.ceil(count / perPage),home: "/campgrounds/?",current: page,})
}

module.exports.renderNewForm = (req,res) => {
    res.render('campgrounds/new')
}

module.exports.createCampground = async (req,res) => {
    const geoData = await geocoder.forwardGeocode({
        query: req.body.campground.location,
        limit: 1
    }).send()
    const campground = new Campground(req.body.campground);
    campground.geometry = geoData.body.features[0].geometry;
    campground.author = req.user._id; 
    campground.images = req.files.map(f => ({ url: f.path, filename: f.filename }));
    await campground.save()
    req.flash('success','Welcome you have created a new campground');
    res.redirect(`/campgrounds/${campground._id}`);
}

module.exports.showCampgrounds = async (req,res) => {
    const campground = await Campground.findById(req.params.id).populate(
       { path:'reviews',
        populate :{path : 'author'}}
    ).populate('author');
    if (!campground) {
        req.flash('error', 'Cannot find that campground!');
        return res.redirect('/campgrounds');
    }
    console.log(campground);
    res.render('campgrounds/show', { campground });
}

module.exports.editCampgrounds = async (req,res) => {
    const {id} = req.params;
    const campground = await Campground.findById(id)
    console.log(campground.images);
    if(!campground){
        req.flash('error','Cannot find that campground');
        return ('/campgrounds');
    }
    res.render('campgrounds/edit', {campground})
}

module.exports.updateCampground = async (req,res) => {
    const {id} = req.params;
    const campground = await Campground.findByIdAndUpdate(id,{...req.body.campground});
    const imgs = req.files.map(f => ({ url: f.path, filename: f.filename }));
    campground.images.push(...imgs);
    await campground.save();
    if (req.body.deleteImages) {
        for (let filename of req.body.deleteImages) {
            await cloudinary.uploader.destroy(filename);
        }
        await campground.updateOne({ $pull: { images: { filename: { $in: req.body.deleteImages } } } })
    }
    req.flash('success','Successfully updated a campground');
    res.redirect(`/campgrounds/${campground._id}`);``
}

module.exports.deleteCampgrounds = async (req,res) => {
    await Campground.findByIdAndDelete(req.params.id);
    req.flash('success',  'Successfully deleted a campground');
    res.redirect('/campgrounds');
}