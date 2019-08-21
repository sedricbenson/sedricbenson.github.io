window.Zwin = {};
window.zwinReferrer = '';
jQuery(document).ready(function ($) {

    Zwin = {
        handleAjaxContext: function (ajaxHeader, defaultMthd, args) {
            if (!!ajaxHeader) {
                var d = JSON.parse(ajaxHeader), mthd;
                for (var ind in d) {
                    mthd = !!d[ind].method ? d[ind].method : (!!defaultMthd ? defaultMthd : 'load');
                    this.loadContext(d[ind].context, mthd, args);
                }
            }
        },
        loadContext: function (context, method, args) {
            try {
                if (!!Zwin[context] && typeof Zwin[context][method] === 'function') {
                    Zwin[context][method](args);
                }
            } catch (e) {
                console.log('Zwin JS Context : failed loading context, [' + e.message + ']');
            }
        },
        init: function () {
            //Load All Contexts
            for (var cntx in this) {
                if (typeof this[cntx] === 'object' && typeof this[cntx]['load'] === 'function') {
                    this[cntx]['load']();
                }
            }
        }
    };

    /* ---------------------------------------------------------------------- */
    /*	Ajax Paging
     /* ---------------------------------------------------------------------- */
    var ajaxTimer = $('#ajax-timer'), ajaxLoaders = '.ajax-btn, #submit',
            logo = $('#logo'),
            profile = $('#profile:visible'),
            currentSection = profile.length !== 0 ? profile : $(".menu ~ section");
    Zwin.AjaxNavigation = {
        currentZwinUri: null,
        fragment: '!',
        strictMode: false,
        load: function () {
            this.currentZwinUri = new this.zwinUri('');
            var self = this;

            //Check if the vcard is loaded in a iframe we need this in case of customize when hashchange dosen't work properly !
            if (window.self === window.top) {
                $(window).hashchange(function ( ) {
                    var zwinUri = new self.zwinUri().fromCurrentHref();
                    self.go(zwinUri);
                });
            } else {
                $("body").on("click", "a", function (event) {
                    event.stopImmediatePropagation();
                    var l = $(this);
                    if (l.attr('href') === '#' || l.attr('href') === '')
                        return;
                    var zwinUri = new self.zwinUri().fromHref(this.href);
                    self.go(zwinUri);
                    return false;
                });
                window.top.less = window.self.less;
            }
        },
        go: function (zwinUri) {
            var self = this;
            window.zwinReferrer = this.currentZwinUri + "";
            if (this.currentZwinUri.path === zwinUri.path) { //We are in the same path
                if (this.currentZwinUri.hash !== zwinUri.hash) {//Hash changes
                    this.hashFocus(zwinUri.hash);
                }
            } else if (zwinUri.isHome()) {//Home
                currentSection.slideUp(600, function () {
                    document.title = profile.data('homeTitle');
                    profile.slideDown(600);
                    currentSection = profile;
                    logo.fadeOut(300);
                    self.selectMenu('home');
                    self.currentZwinUri = zwinUri;
                });
                return true;
            } else {
                $.ajax({
                    url: zwinUri.toString(),
                    data: {'zwin-ajax-nonce': 1},
                    beforeSend: function () {
                        ajaxTimer.animate({width: "100%"}, 1000);
                        $(ajaxLoaders).css({overflow: 'initial', position: 'relative'});
                        $(ajaxLoaders).addClass('ajax-in-action');
                    },
                    success: function (html, textStatus, request) {
                        if (request.getResponseHeader('Zwin-Page-Title') !== null) {
                            document.title = request.getResponseHeader('Zwin-Page-Title');
                        }
                        var loaded = false;
                        if (self.currentZwinUri.pageChange(zwinUri)) {
                            loaded = self.partialLoad(zwinUri, html, request);
                        }

                        if (!loaded) {
                            loaded = self.sectionLoad(zwinUri, html, request);
                        }
                    },
                    error: function (jqXHR, textStatus, errorThrown) {
                        alert(errorThrown);
                    },
                    complete: function () {
                        ajaxTimer.stop().width("0%");
                        $(ajaxLoaders).removeClass('ajax-in-action');
                    }
                });
            }
            return true;
        },
        afterLoad: function (zwinUri, nextPage) {
            this.currentZwinUri = zwinUri;
            if (!!nextPage) {
                $('#page_nav').attr('href', nextPage);
            } else {
                $('#page_nav').fadeOut('fast');
            }
        },
        partialLoad: function (zwinUri, html, request) {
            var paginationData = $.unserialize(request.getResponseHeader('Zwin-Next'));
            if ($(paginationData.container).length === 0) {
                return false;
            }
            var newItems = $(html).find(paginationData.item);
            newItems.each(function () {
                $(paginationData.container).isotope('insert', $(this));
            });
            //Load JS Context
            Zwin.handleAjaxContext(request.getResponseHeader('Zwin-Js-Context'), 'update', newItems);
            if (!!paginationData.event) {
                $(document).trigger(paginationData.event);
            }
            this.afterLoad(zwinUri, paginationData.next);
            return true;

        },
        sectionLoad: function (zwinUri, html, request) {
            var paginationData = $.unserialize(request.getResponseHeader('Zwin-Next')), self = this;
            var newSection = $(html).css('display', 'none');
            currentSection.slideUp(600, function () {
                $(".menu ~ section").replaceWith(newSection);
                newSection.slideDown(600, function () {
                    if (zwinUri.hash) {
                        self.hashFocus(zwinUri.hash);
                    }
                });
                currentSection = newSection;
                //Select current Menu
                self.selectMenu(request.getResponseHeader('Zwin-Menu-ID'));
                logo.fadeIn(500);
                //Load JS Context
                Zwin.handleAjaxContext(request.getResponseHeader('Zwin-Js-Context'));
                self.afterLoad(zwinUri, paginationData.next);
            });
            return true;
        },
        hashFocus: function (vhash) {
            if (!!vhash === false || vhash.match(/lightbox\[([0-9]+)\]\/([0-9]+)\//g)) {
                return false;
            }
            var element = document.getElementById(vhash);
            if (element) {
                if (!/^(?:a|select|input|button|textarea)$/i.test(element.tagName))
                    element.tabIndex = -1;
                element.focus();
            }
        },
        selectMenu: function (id) {
            if (!!id && $('.menu-item-' + id).length !== 0) {
                $('.current-menu-item, .current_page_item').removeClass('current-menu-item current_page_item').css({'width': 120, margin: "10px 0 0"});
                $('.menu-item-' + id).addClass('current-menu-item').css({'width': 108, margin: "10px 6px 0"});
            }
            var b = $("body");
            if (b.data("zwinFirstMenu") !== true && id !== 'home') {
                b.trigger("first-menu.zwin");
                b.data("zwinFirstMenu", true);
            }
        },
        // parseUri 1.2.2
        // (c) Steven Levithan <stevenlevithan.com>
        // MIT License
        _parseUri: function (str) {

            /*jslint unparam: true */
            var parsers = {
                strict: /^(?:([^:\/?#]+):)?(?:\/\/((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?))?((((?:[^?#\/]*\/)*)([^?#]*))(?:\?([^#]*))?(?:#(.*))?)/,
                loose: /^(?:(?![^:@]+:[^:@\/]*@)([^:\/?#.]+):)?(?:\/\/)?((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/
            },
            keys = ["source", "protocol", "authority", "userInfo", "user", "password", "host", "port", "relative", "path", "directory", "file", "query", "anchor"],
                    q = {
                        name: "queryKey",
                        parser: /(?:^|&)([^&=]*)=?([^&]*)/g
                    },
            m = parsers[this.strictMode ? "strict" : "loose"].exec(str),
                    uri = {},
                    i = 14;
            while (i--) {
                uri[keys[i]] = m[i] || "";
            }

            uri[q.name] = {};
            uri[keys[12]].replace(q.parser, function ($0, $1, $2) {
                if ($1) {
                    uri[q.name][$1] = $2;
                }
            });
            return uri;
        },
        _decode: function (s) {
            s = decodeURIComponent(s);
            s = s.replace('+', ' ');
            return s;
        },
        zwinUri: function (path, hash) {
            this.baseURL = WPOPTS.SITE_URL;
            this.path = !!path ? path : '';
            this.hash = !!hash ? hash : false;
            this.page = 1;
            this.toString = function () {
                var url = this.baseURL;
                if (this.path !== false) {
                    url += '/' + this.path;
                }

                if (this.hash !== false) {
                    url += '#' + this.hash;
                }
                return url;
            };
            this.pageChange = function (newUri) {
                return this.path.replace(/page\/([0-9]{1,})\/?/g, '') === newUri.path.replace(/page\/([0-9]{1,})\/?/g, '') &&
                        this.page < newUri.page;
            };
            this.fromHref = function (href) {

                var uri = Zwin.AjaxNavigation._parseUri(Zwin.AjaxNavigation._decode(href));

                if (uri.anchor[0] === Zwin.AjaxNavigation.fragment) {
                    var parts = uri.anchor.split('#');
                    this.path = parts[0].substring(2);
                    this.hash = !!parts[1] ? parts[1] : false;

                    //Extract Page
                    var matches = /\/page\/([0-9]{1,})\/?/g.exec(this.path);
                    if (matches !== null) {
                        this.page = parseInt(matches[1]);
                    }

                } else if (uri.anchor !== '') {
                    this.hash = uri.anchor;
                }
                return this;

            };
            this.fromCurrentHref = function () {
                return this.fromHref(window.location.href);
            };
            this.isHome = function () {
                return this.path === "";
            };
        }
    };
    Zwin.AjaxNavigation.selectMenu('home');
    /* ---------------------------------------------------------------------- */
    /*	Common Functions
     /* ---------------------------------------------------------------------- */
    function zwin_flicker() {
        $('.flicker-stream-widget').each(function () {
            if (!!$(this).data('jflickrfeed')) {
                return;
            }
            $(this).jflickrfeed({
                limit: 8,
                qstrings: {
                    id: $(this).data('flickrId')
                },
                itemTemplate:
                        '<li>' +
                        '<a target="_blank" href="{{link}}"><img class="transition" src="{{image_s}}" alt="{{title}}" /></a>' +
                        '</li>'
            });
            $(this).data('jflickrfeed', true);
        });
    }
    /* ---------------------------------------------------------------------- */
    /*	Profile
     /* ---------------------------------------------------------------------- */
    Zwin.Profile = {
        socialIconsInit: function () {
            var socialPane = $('#socialPane'),
                    socialMore = $('.social-more'),
                    socialCount = socialPane.find('li').length,
                    perView = 3,
                    vv = 0,
                    iconWidth = 32, newLeft, viewWidth;
            if (perView >= socialCount) {
                viewWidth = socialCount * iconWidth;
            } else {
                viewWidth = perView * iconWidth;
                socialMore.show().stop();
            }
            socialPane.width(viewWidth);
            socialMore.click(function () {
                if (perView + vv === socialCount) {
                    newLeft = 0;
                    vv = 0;
                } else {
                    vv++;
                    newLeft = vv * iconWidth;
                }
                socialPane.find('ul').animate({left: -newLeft}, 'fast', 'swing');
                return false;
            });
        },
        photosSilderInit: function () {
            $(".photo-inner ul").carouFredSel({
                direction: "left",
                circular: true,
                auto: true,
                scroll: {
                    items: 1,
                    fx: 'crossfade',
                    duration: 1500,
                    wipe: true
                },
                swipe: {
                    onTouch: true
                },
                items: {
                    width: 153
                }
            });
        },
        menuTabInit: function () {
            var content = $("#content");
            $("body").on("first-menu.zwin", function () {
                $(".menu .tabs").trigger("configuration", function (opt) {
                    var p = Math.floor($(".tabs li.current-menu-item").index() / opt.items.visible);
                    $(".menu .tabs").trigger("slideToPage", p);
                });
            });
            // Hover menu effect
            content.find('.tabs li a').hover(
                    function () {
                        $(this).stop().animate({marginTop: "-7px"}, 200);
                    },
                    function () {
                        $(this).stop().animate({marginTop: "0px"}, 300);
                    }
            );
            $(".menu .tabs").carouFredSel({
                responsive: true,
                direction: "left",
                circular: false,
                infinite: false,
                pagination: "#menu-controls",
                auto: false,
                scroll: {
                    items: 1,
                    duration: 300,
                    wipe: true
                },
                prev: {
                    button: "#menu-prev",
                    key: "right"
                },
                next: {
                    button: "#menu-next",
                    key: "left"
                },
                swipe: {
                    onTouch: true
                },
                items: {
                    width: 140,
                    visible: {
                        min: 2,
                        max: 5
                    }
                }
            });
        },
        load: function () {
            this.menuTabInit();
            this.socialIconsInit();
            this.photosSilderInit();
        }
    };
    /* ---------------------------------------------------------------------- */
    /*	Resume
     /* ---------------------------------------------------------------------- */
    Zwin.Resume = {
        load: function () {
            $(".skills li .rating").each(function (index, e) {
                var skill = $(e), rat, rat_dot;
                rat = skill.attr("data-rat");
                for (var i = 0; i < 7; i++) {
                    rat_dot = $("<span></span>");
                    skill.append(rat_dot);
                    if (i < rat) {
                        rat_dot.animate({opacity: 1});
                    }
                }
            });
        }
    };
    /* ---------------------------------------------------------------------- */
    /*	Portfolio
     /* ---------------------------------------------------------------------- */
    Zwin.Portfolio = {
        _bindElements: function (elements, is_single) {
            elements.each(function (index, el) {
                var jEl = $(el);
                jEl.find('img').adipoli({
                    'startEffect': WPOPTS.ADIPOLI_START,
                    'hoverEffect': WPOPTS.ADIPOLI_HOVER,
                    'imageOpacity': 0.6,
                    'animSpeed': 100
                });
                jEl.find("a[rel^='lightbox']").prettyPhoto({
                    animation_speed: 'fast', /* fast/slow/normal */
                    social_tools: !!is_single ? '' : '<a href="#" class="lightbox-comments-link button">' + RBISTA_LANG.COMMENTS + '</a>',
                    theme: 'pp_default',
                    horizontal_padding: 5
                });
            });
        },
        load: function () {
            this.portfolioList = $('#portfolio-list');
            this.portfolioFilter = $('#portfolio-filter');
            // Run Isotope  
            this.portfolioList.isotope({
                filter: '*',
                layoutMode: 'masonry',
                animationOptions: {
                    duration: 750,
                    easing: 'linear'
                }
            });
            // Isotope Filter 
            var self = this;
            this.portfolioFilter.find('a').click(function () {
                self.portfolioFilter.find('a').removeClass('current');
                $(this).addClass('current');
                var selector = $(this).attr('data-filter');
                self.portfolioList.isotope({
                    filter: selector,
                    animationOptions: {
                        duration: 750,
                        easing: 'linear',
                        queue: false
                    }
                });
                return false;
            });
            this._bindElements(this.portfolioList.find('> li'));
            this._bindElements($('article.portfolio-entry'));
            zwin_flicker();
        },
        update: function (newElements) {
            this._bindElements(newElements);
        },
        comments: function (commentsEl) {
            commentsEl.find('#submit').after('<input type="hidden" name="redirect_to" value="' + encodeURI(window.location.href) + '" id="redirect_to">');
        },
        single: function () {
            this._bindElements($('.portfolio-entry'), true);
            zwin_flicker();
        }
    };
    /* ---------------------------------------------------------------------- */
    /*	Blog
     /* ---------------------------------------------------------------------- */
    Zwin.Blog = {
        load: function () {
            this.blogList = $('#blog-list');
            this.blogFilter = $('#blog-filter');
            // Run Isotope  
            this.blogList.isotope({
                filter: '*',
                layoutMode: 'straightDown',
                itemSelector: '.blog-entry',
                animationOptions: {
                    duration: 750,
                    easing: 'linear'
                }
            });
            // Isotope Filter 
            var self = this;
            this.blogFilter.find('a').click(function () {
                self.blogFilter.find('a').removeClass('current');
                $(this).addClass('current');
                var selector = $(this).attr('data-filter');
                self.blogList.isotope({
                    filter: selector,
                    animationOptions: {
                        duration: 750,
                        easing: 'linear',
                        queue: false
                    }
                });
                return false;
            });
            // Hide/show Date
            $('.entry-thumbnail').hover(function (event) {
                $(this).find(".entry-date").stop().fadeOut();
                $(this).find(".entry-categories").stop().fadeOut();
            }, function (event) {
                $(this).find(".entry-date").stop().fadeIn();
                $(this).find(".entry-categories").stop().fadeIn();
            });
            //Flickr Stream
            zwin_flicker();
        },
        update: function (newElements) {

        },
        single: function () {
            $('.blog-single-close').attr('href', function () {
                if (window.zwinReferrer.indexOf(WPOPTS.BLOG_URL.replace('/#!', '')) !== -1) {
                    return window.zwinReferrer.replace(WPOPTS.SITE_URL, WPOPTS.SITE_URL + '/#!');
                }
                return WPOPTS.BLOG_URL;
            });
            var pp_d = {
                animation_speed: 'fast', /* fast/slow/normal */
                social_tools: '',
                horizontal_padding: 5
            };
            $("a[rel^='lightbox']").prettyPhoto(pp_d);
            //$(".wp-caption > a").prettyPhoto(pp_d);
            $(".blog-entry a:not([rel^='lightbox']) > img").parent().prettyPhoto(pp_d);
            //Flickr Stream
            zwin_flicker();
        }
    };
    /* ---------------------------------------------------------------------- */
    /*	Contact Form
     /* ---------------------------------------------------------------------- */
    Zwin.Contact = {
        load: function () {

            // Google Maps
            var $map = $('#map'),
                    $lat = WPOPTS.GMAP_LATITUDE,
                    $lon = WPOPTS.GMAP_LONGITUDE;
            $map.gmap().bind('init', function (ev, map) {
                $map.gmap('addMarker', {'position': $lat + ',' + $lon, 'bounds': true}).click(function () {
                    $map.gmap('openInfoWindow', {'content': WPOPTS.GMAP_MSG}, this);
                });
                $map.gmap('option', 'zoom', 16);
            });

            // Contect Form
            var contactform = $('#contactform'), sendButton = $('#sendMail'), orginText;
            contactform.submit(function (event) {
                event.preventDefault();
                orginText = sendButton.text();
                sendButton.text(sendButton.data('loadingText'));
                sendButton.attr('disabled', 'disabled');
                $.ajax({
                    type: "POST",
                    dataType: 'json',
                    url: WPOPTS.AJAX_URL,
                    data: $(this).serialize() + "&action=rbista_send_mail",
                    success: function (data) {
                        var response;
                        if (data.success === 200) {
                            response = '<div class="success">' + data.message + '</div>';
                        } else {
                            response = '<div class="error">' + data.message + '</div>';
                        }
                        // Hide any previous response text
                        $(".error,.success").remove();
                        // Show response message
                        contactform.prepend(response);
                        contactform.get(0).reset();
                        return false;
                    },
                    complete: function () {
                        sendButton.text(orginText);
                        sendButton.removeAttr('disabled');
                    }
                });
                return false;
            });
        }
    };
    /* ---------------------------------------------------------------------- */
    /*	Comments
     /* ---------------------------------------------------------------------- */
    $(document).on('submit.zwin', '#commentform', function (event) {
        event.preventDefault();
        var form = $(this);
        var url = form.attr('action');
        var data = form.serialize();
        $.ajax({
            type: 'POST',
            url: url + "?zwin_ajax_die=true",
            data: data,
            beforeSend: function () {
                ajaxTimer.animate({width: "100%"}, 1000);
            },
            success: function (data, textStatus, request) {
                console.log(data);
                var parent_comment = form.parent().prev('.comment'), comments_list;
                if (parent_comment.length !== 0) {
                    var next = parent_comment.next();
                    //jump the form 
                    if (next.hasClass('comment-respond')) {
                        next = next.next();
                    }
                    if (next.hasClass('children')) {
                        next.append(data);
                    } else {
                        parent_comment.after('<ul class="children">' + data + '</ul>');
                    }
                } else {
                    comments_list = $('.comments-list');
                    if (parent_comment.length !== 0) {
                        comments_list.append(data);
                    } else {
                        form.parent().before('<ul class="comments-list">' + data + '</ul>');
                    }
                }
                $('#cancel-comment-reply-link').trigger('click');
                form.get(0).reset();
                form.prepend('<div class="success">' + RBISTA_LANG.COMMENT_SUCCESS + '</div>');
                setTimeout(function () {
                    $('.success').fadeOut();
                }, 3000);
            },
            error: function (jqXHR, textStatus, errorThrown) {
                form.prepend('<div class="error">' + RBISTA_LANG.COMMENT_ERROR + '</div>');
                setTimeout(function () {
                    $('.error').fadeOut();
                }, 3000);
            },
            complete: function () {
                ajaxTimer.stop().width("0%");
            }
        });
        return false;
    });

    Zwin.init();
    $(window).trigger('hashchange');
});	