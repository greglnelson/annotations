/**
 *  Copyright 2012, Entwine GmbH, Switzerland
 *  Licensed under the Educational Community License, Version 2.0
 *  (the "License"); you may not use this file except in compliance
 *  with the License. You may obtain a copy of the License at
 *
 *  http://www.osedu.org/licenses/ECL-2.0
 *
 *  Unless required by applicable law or agreed to in writing,
 *  software distributed under the License is distributed on an "AS IS"
 *  BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
 *  or implied. See the License for the specific language governing
 *  permissions and limitations under the License.
 *
 */

/**
 * A module representing the video model
 * @module models-video
 * @requires collections-tracks
 * @requires collections-categories
 * @requires collections-scales
 * @requires ACCESS
 * @requires underscore.js
 * @requires backbone.js
 */ 
define(["jquery",
        "collections/tracks",
        "collections/categories",
        "collections/scales",
        "order!access",
        "order!use!backbone"],
    

    function($, Tracks, Categories, Scales, ACCESS, Backbone){
    
        "use strict";

        /**
         * @constructor
         * @see {@link http://www.backbonejs.org/#Model}
         * @memberOf module:models-video
         * @alias Video
         */
        var Video = Backbone.Model.extend({

            /** 
             * Default models value 
             * @alias module:models-video.Video#defaults
             */
            defaults: {
                access: ACCESS.PUBLIC,
            },
            
            /**
             * Constructor
             * @alias module:models-video.Video#initialize
             * @param {Object} attr Object literal containing the model initialion attribute. 
             */
            initialize: function(attr){
                
                // Check if the video has been initialized 
                if (!attr.id) {
                    // If local storage, we set the cid as id
                    if (window.annotationsTool.localStorage) {
                        attr.id = this.cid;
                    }
                        
                    this.toCreate = true;
                }
                
                // Check if tracks are given 
                if (attr.tracks && _.isArray(attr.tracks)) {
                    this.set({tracks: new Tracks(attr.tracks,this)});
                }  else {
                    this.set({tracks: new Tracks([],this)});
                }
                
                // Check if supported categories are given
                if (attr.categories && _.isArray(attr.categories)) {
                    this.set({categories: new Categories(attr.categories,this)});
                } else {
                    this.set({categories: new Categories([],this)});
                }

                // Check if the possible video scales are given
                if (attr.scales && _.isArray(attr.scales)) {
                    this.set({scales: new Scales(attr.scales,this)});
                } else {
                    this.set({scales: new Scales([],this)});
                }

                if (attr.id) {
                    this.get("categories").fetch({async:false});
                    this.get("tracks").fetch({async:false});
                    this.get("scales").fetch({async:false});
                }

                // Add backbone events to the model 
                _.extend(this, Backbone.Events);
                
                // Define that all post operation have to been done through PUT method
                this.noPOST = true;
            },
            
            /**
             * Parse the attribute list passed to the model
             * @alias module:models-video.Video#parse
             * @param  {Object} data Object literal containing the model attribute to parse.
             * @return {Object}  The object literal with the list of parsed model attribute.
             */
            parse: function(data) {
                var attr = data.attributes ? data.attributes : data;

                attr.created_at = attr.created_at !== null ? Date.parse(attr.created_at): null;
                attr.updated_at = attr.updated_at !== null ? Date.parse(attr.updated_at): null;
                attr.deleted_at = attr.deleted_at !== null ? Date.parse(attr.deleted_at): null;
                attr.settings   = this.parseJSONString(attr.settings);

                // Parse tags if present
                if (attr.tags) {
                    attr.tags = this.parseJSONString(attr.tags);
                }

                if (data.attributes) {
                    data.attributes = attr;  
                } else {
                    data = attr;
                }

                return data;
            },
            
            /**
             * Validate the attribute list passed to the model
             * @alias module:models-video.Video#validate
             * @param  {Object} data Object literal containing the model attribute to validate.
             * @return {String}  If the validation failed, an error message will be returned.
             */
            validate: function(attr) {

                var tmpCreated,
                    categories,
                    tracks,
                    scales,
                    self = this;
                
                if(attr.id){
                    if(this.get('id') !== attr.id){
                        this.id = attr.id;
                        this.attributes.id = attr.id;
                        this.setUrl();

                        categories = this.attributes.categories;
                        tracks     = this.attributes.tracks;
                        scales     = this.attributes.scales;
   


                        if (tracks && (tracks.length) === 0) {
                            tracks.fetch({
                                async:false,
                                success: function(){
                                    self.tracksReady = true;
                                    if (self.tracksReady && self.categoriesReady && self.scalesReady) {
                                        self.trigger("ready");
                                    }
                                }
                            }); 
                        }

                        if (scales && (scales.length) === 0) {
                            scales.fetch({
                                async:false,
                                success: function(){
                                    self.scalesReady = true;
                                    
                                    if (categories && (categories.length) === 0) {
                                        categories.fetch({
                                            async:false,
                                            success: function(){
                                                self.categoriesReady = true;
                                                if (self.tracksReady && self.categoriesReady && self.scalesReady) {
                                                    self.trigger("ready");
                                                }
                                            }
                                        });
                                    } else if (self.tracksReady && self.categoriesReady && self.scalesReady) {
                                        self.trigger("ready");
                                    }
                                }
                            });
                        }
                    }
                }
                
                if (attr.tracks && !(attr.tracks instanceof Tracks)) {
                    return "'tracks' attribute must be an instance of 'Tracks'";
                }

                if (attr.tags && _.isUndefined(this.parseJSONString(attr.tags))) {
                    return "'tags' attribute must be a string or a JSON object";
                }
                
                if (attr.created_by && !(_.isNumber(attr.created_by) || attr.created_by instanceof User)) {
                    return "'created_by' attribute must be a number or an instance of 'User'";
                }
                
                if (attr.updated_by && !(_.isNumber(attr.updated_by) || attr.updated_by instanceof User)) {
                    return "'updated_by' attribute must be a number or an instance of 'User'";
                }
                
                if (attr.deleted_by && !(_.isNumber(attr.deleted_by) || attr.deleted_by instanceof User)) {
                    return "'deleted_by' attribute must be a number or an instance of 'User'";
                }
                
                if (attr.created_at) {
                    if ((tmpCreated=this.get('created_at')) && tmpCreated!==attr.created_at) {
                        return "'created_at' attribute can not be modified after initialization!";
                    } else if (!_.isNumber(attr.created_at)) {
                        return "'created_at' attribute must be a number!";
                    }
                }
        
                if (attr.updated_at){
                    if(!_.isNumber(attr.updated_at)) {
                        return "'updated_at' attribute must be a number!";
                    }
                }

                if (attr.deleted_at) {
                    if (!_.isNumber(attr.deleted_at)) {
                        return "'deleted_at' attribute must be a number!";
                    }
                }
            },
            
            /**
             * Modify the current url for the tracks collection
             * @alias module:models-video.Video#setUrl
             */
            setUrl: function () {
                if (this.attributes.tracks) {
                    this.attributes.tracks.setUrl(this);    
                }

                if (this.attributes.categories) {
                    this.attributes.categories.setUrl(this);    
                }

                if (this.attributes.scales) {
                    this.attributes.scales.setUrl(this);    
                }
            },

            /**
             * Parse the given parameter to JSON if given as String
             * @alias module:models-video.Video#parseJSONString
             * @param  {String} parameter the parameter as String
             * @return {JSON} parameter as JSON object
             */
            parseJSONString: function(parameter) {
                if (parameter && _.isString(parameter)) {
                    try {
                        parameter = JSON.parse(parameter);
                        
                    } catch (e) {
                        console.warn("Can not parse parameter '"+parameter+"': "+e);
                        return undefined; 
                    }
                } else if (!_.isObject(parameter) || _.isFunction(parameter)) {
                    return undefined;
                }

                return parameter;
            },

            /**
             * Override the default toJSON function to ensure complete JSONing.
             * @alias module:models-video.Video#toJSON
             * @return {JSON} JSON representation of the instane
             */
            toJSON: function(){
                var json = $.proxy(Backbone.Model.prototype.toJSON,this)();
                delete json.tracks;
                delete json.categories;
                delete json.scales;

                return json;
            }
        });
        
        return Video;
    
});