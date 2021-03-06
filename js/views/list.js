 
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
 * A module representing the annotations list view
 * @module views-list
 * @requires jQuery
 * @requires prototype-player_adapter
 * @requires models-annotation
 * @requires views-list-annotation
 * @requires backbone
 * @requires filters-manager
 * @requires bootsrap.scrollspy
 */
define(["jquery",
        "prototypes/player_adapter",
        "models/annotation",
        "collections/annotations",
        "views/list-annotation",
        "backbone",
        "FiltersManager",
        "scrollspy"],

    function ($, PlayerAdapter, Annotation, Annotations, AnnotationView, Backbone, FiltersManager) {

        "use strict";

        /**
         * @constructor
         * @see {@link http://www.backbonejs.org/#View}
         * @augments module:Backbone.View
         * @memberOf module:views-list
         * @alias module:views-list.List
         */
        var List = Backbone.View.extend({

            /**
             * Annotations list container of the appplication
             * @alias module:views-list.List#el
             * @type {DOM element}
             */
            el: $("div#list-container"),

            /**
             * Annotation views list
             * @alias module:views-list.List#annotationViews
             * @type {Array}
             */
            annotationViews: [],


            /**
             * List of filter used for the list elements
             * @alias module:views-list.List#filters
             * @type {Object}
             */
            filters: {
                // Define if only the annotation created by the current user should be visible in the list
                mine: {
                    active: false,
                    filter: function (list) {
                        return _.filter(list, function (annotationView) {
                            return annotationView.model.get("isMine");
                        }, this);
                    }
                }
            },

            /**
             * Events to handle
             * @alias module:views-list.List#events
             * @type {object}
             */
            events: {
                "click #filter-none"    : "disableFilter",
                "click .filter"         : "switchFilter",
                "click .toggle-collapse": "toggleVisibility",
                "click .collapse-all"   : "collapseAll",
                "click .expand-all"     : "expandAll"
            },

            /**
             * Constructor
             * @alias module:views-list.List#initialize
             * @param {PlainObject} attr Object literal containing the view initialization attributes.
             */
            initialize: function () {
                // Bind functions to the good context
                _.bindAll(this, "render",
                               "addTrack",
                               "addAnnotation",
                               "addList",
                               "sortViewsbyTime",
                               "reset",
                               "select",
                               "unselect",
                               "switchFilter",
                               "updateFiltersRender",
                               "toggleVisibility",
                               "disableFilter",
                               "expandAll",
                               "collapseAll");

                this.annotationViews = [];
                this.filtersManager  = new FiltersManager(annotationsTool.filtersManager);
                this.categories      = annotationsTool.video.get("categories");
                this.tracks          = annotationsTool.video.get("tracks");
                this.playerAdapter   = annotationsTool.playerAdapter;

                this.listenTo(this.filtersManager, "switch", this.updateFiltersRender);
                this.listenTo(this.categories, "change", this.render);
                this.listenTo(this.tracks, "add", this.addTrack);
                this.listenTo(annotationsTool, annotationsTool.EVENTS.ANNOTATION_SELECTION, this.select);

                this.tracks.each(this.addTrack, this);

                // Add backbone events to the model
                _.extend(this, Backbone.Events);

                return this.render();
            },

            /**
             * Add one track
             * @alias module:views-list.List#initialize
             * @param {Track} track to add
             */
            addTrack: function (track) {
                var ann = track.get("annotations"),
                    annotationTrack = track;

                this.listenTo(ann, "add", $.proxy(function (newAnnotation) {
                    this.addAnnotation(newAnnotation, annotationTrack);
                }, this));

                this.listenTo(ann, "destroy", this.removeOne);
                this.listenTo(ann, "change", this.sortViewsbyTime);

                this.addList(ann.toArray(), annotationTrack);
            },

            /**
             * Add an annotation as view to the list
             * @alias module:views-list.List#addAnnotation
             * @param {Annotation} the annotation to add as view
             * @param {Track} track Annotation target
             * @param {Boolean} isPartofList Define if the annotation is added with a whole list
             */
            addAnnotation: function (addAnnotation, track, isPartofList) {
                var view;

                // If annotation has not id, we save it to have an id
                if (!addAnnotation.id) {
                    this.listenTo(addAnnotation, "ready", this.addAnnotation);
                    return;
                }

                view = new AnnotationView({annotation: addAnnotation, track: track});
                this.annotationViews.push(view);

                if (!isPartofList) {
                    this.sortViewsbyTime();
                    annotationsTool.setSelection([addAnnotation], false);
                }
            },

            /**
             * Add a list of annotation, creating a view for each of them
             * @alias module:views-list.List#addList
             * @param {Array} annotationsList List of annotations
             */
            addList: function (annotationsList, track) {
                _.each(annotationsList, function (annotation) {
                    this.addAnnotation(annotation, track, true);
                }, this);

                if (annotationsList.length > 0) {
                    this.sortViewsbyTime();
                }
            },

            /**
             * Select the given annotation
             * @alias module:views-list.List#select
             * @param  {Annotation} annotations The annotation to select
             */
            select: function (annotations) {
                var view;

                this.unselect();

                _.each(annotations, function (annotation, index) {
                    view = this.getViewFromAnnotation(annotation.get("id"));

                    if (view) {
                        view.selectVisually();
                        view.isSelected = true;

                        // Only scroll the list to the first item of the selection
                        if (index === 0) {
                            location.hash = "#" + view.id;
                        }
                    }
                }, this);
            },

            /**
             * Unselect all annotation views
             * @alias module:views-list.List#unselect
             */
            unselect: function ()  {
                var id,
                    view,
                    self = this;

                this.$el.find(".selected").each(function () {
                        id = $(this).attr("id"),
                        view = self.getViewFromAnnotation(id);
                        $(this).removeClass("selected");

                        if (view) {
                            view.isSelected = false;
                        }
                    });
            },

            /**
             * Get the view representing the given annotation
             * @alias module:views-list.List#getViewFromAnnotation
             * @param  {String} id The target annotation id
             * @return {ListAnnotation}            The view representing the annotation
             */
            getViewFromAnnotation: function (id) {
                return _.find(this.annotationViews, function (view) {
                            return view.model.get("id") == id;
                        }, this);
            },

            /**
             * Remove the given annotation from the views list
             * @alias module:views-list.List#removeOne
             * @param {Annotation} Annotation from which the view has to be deleted
             */
            removeOne: function (delAnnotation) {
                _.find(this.annotationViews, function (annotationView, index) {
                    if (delAnnotation === annotationView.model) {
                        this.annotationViews.splice(index, 1);
                        this.render();
                        return;
                    }
                }, this);
            },

            /**
             * Sort all the annotations in the list by start time
             * @alias module:views-list.List#sortViewsByTime
             */
            sortViewsbyTime: function () {
                this.annotationViews = _.sortBy(this.annotationViews, function (annotationView) {
                    return annotationView.model.get("start");
                });
                this.render();
            },

            /**
             * Switch on/off the filter related to the given event
             * @alias module:views-list.List#switchFilter
             * @param  {Event} event
             */
            switchFilter: function (event) {
                var active = !$(event.target).hasClass("checked"),
                    id = event.target.id.replace("filter-", "");

                this.filtersManager.switchFilter(id, active);
            },

            updateFiltersRender: function (attr) {
                if (attr.active) {
                    this.$el.find("#filter-" + attr.id).addClass("checked");
                } else {
                    this.$el.find("#filter-" + attr.id).removeClass("checked");
                }
                this.render();
            },

            /**
             * Disable all the list filter
             * @alias module:views-list.List#disableFilter
             */
            disableFilter: function () {
                this.$el.find("#filter").removeClass("checked");

                this.filtersManager.disableFilters();

                this.render();
            },

            /**
             * Expand all annotations in the list
             * @alias module:views-list.List#expandAll
             */
            expandAll: function () {
                _.each(this.annotationViews, function (annView) {
                    if (annView.collapsed) {
                        annView.onCollapse();
                    }
                }, this);
            },

            /**
             * Collapse all annotations in the list
             * @alias module:views-list.List#collapseAll
             */
            collapseAll: function () {
                _.each(this.annotationViews, function (annView) {
                    if (!annView.collapsed) {
                        annView.onCollapse();
                    }
                }, this);
            },

            /**
             * Display the list
             * @alias module:views-list.List#render
             */
            render: function () {
                var list = this.annotationViews;

                this.$el.find("#content-list").empty();

                _.each(this.filtersManager.getFilters(), function (filter) {
                    if (filter.active) {
                        list = filter.filter(list);
                    }
                });

                _.each(list, function (annView) {
                    this.$el.find("#content-list").append(annView.render().$el);
                }, this);

                return this;
            },

            /**
             * Reset the view
             * @alias module:views-list.List#reset
             */
            reset: function () {
                this.$el.hide();

                _.each(this.annotationViews, function (annView) {
                    annView.undelegateEvents();
                    annView.stopListening();
                }, this);

                this.stopListening();

                this.annotationViews = [];
                this.$el.find("#content-list").empty();

                delete this.annotationViews;
                delete this.tracks;
                this.undelegateEvents();
            },

            toggleVisibility: function (event) {
                var mainContainer = this.$el.find("#content-list");

                if (mainContainer.css("display") === "none") {
                    mainContainer.show();
                    $("div#list-container").toggleClass("expanded");
                    $(event.target).html("Collapse");
                } else {
                    mainContainer.hide();
                    $("div#list-container").toggleClass("expanded");
                    $(event.target).html("Expand");
                }
                this.trigger("change-layout");
            }

        });
        return List;

    });