$(function(){


  Bookmarks = {}
  Bookmarks.nextOrder = function(){}

  var Bookmark = Backbone.Model.extend({


      defaults: function() {
        return {
          title : null,
          url : null,
          created : new Date(),
          order: Bookmarks.nextOrder(),
          done : false
        }
      },


      initialize : function(){
          if (!this.get("title")) {
            this.set({"title": this.defaults().title});
          }

          if (!this.get("url")) {
            this.set({"url": this.defaults().url});
          }

      },


      toggle: function(){
          this.save({done: !this.get("done")});
      },


      details_from_chrome: function(callback){
          var _this = this
          chrome.tabs.query({
              active: true,
              windowId: chrome.windows.WINDOW_ID_CURRENT
          }, 
          function(array_of_Tabs) {
              var tab = array_of_Tabs[0];
              _this.set({'title' : tab.title})
              _this.set({'url' : tab.url})
          });

          return this;
      }

  })

  var BookmarkList = Backbone.Collection.extend({


      model: Bookmark,

      localStorage: new Backbone.LocalStorage("bookmarks-bookmarks"),

      done: function() {
         return this.filter(function(bookmark){ return bookmark.get('done'); });
      },

      remaining: function() {
          return this.without.apply(this, this.done());
      },

      nextOrder: function() {
          if (!this.length) return 1;
          return this.last().get('order') + 1;
      },

      comparator: function(bookmark) {
          return - new Date(bookmark.get('created')).getTime();
      }

  });


  var Bookmarks = new BookmarkList;

  var BookmarkView = Backbone.View.extend({

      tagName:  "li",

      template: function(model){
        var str =   '<label class="checkbox">'
        str = str + '<input class="toggle" type="checkbox" '+ (model.done ? 'checked="checked"' : '')+'/>'
        str = str + '<a class="link" href='+_.escape(model.url)+'>'+_.escape(model.title)+'</a><a href="" class="destroy"><i class="icon-remove"></i></a>'
        str = str + '</label>'
        str = str + '<label><small><em>url: '+_.escape(model.url)+'</small></em></label>'
        return str
      },

      events: {
        "click .toggle"   : "toggleDone",
        "click #edit"  : "edit",
        "click .link" : "navigate",
        "click a.destroy" : "clear",
        "keypress .edit"  : "updateOnEnter",
        "blur .edit"      : "close"
      },

      initialize: function() {
        this.model.on('change', this.render, this);
        this.model.on('destroy', this.remove, this);
      },

      render: function() {
        this.$el.html(this.template(this.model.toJSON()));
        this.$el.toggleClass('done', this.model.get('done'));
        this.input = this.$('.edit');
        return this;
      },

      toggleDone: function() {
        this.model.toggle();
      },

      edit: function(e) {
        e.preventDefault()
        this.$el.addClass("editing");
        this.input.focus();
      },

      close: function() {
        var value = this.input.val();
        if (!value) {
          this.clear();
        } else {
          this.model.save({title: value});
          //this.model.details_from_chrome()
          this.$el.removeClass("editing");
        }
      },

      // If you hit `enter`, we're through editing the item.
      updateOnEnter: function(e) {
        if (e.keyCode == 13) this.close();
      },

      // Remove the item, destroy the model.
      clear: function(e) {
        e.preventDefault()
        this.model.destroy();

      },

      navigate: function(e){
        e.preventDefault()
        chrome.tabs.update(null, {url:this.model.get('url')});
      }

  });

  var AppView = Backbone.View.extend({

      el: $("#todoapp"),

      statsTemplate: function(model){
      var str = ''
      if (model.done) {
        str = str + '<a id="clear-completed"><button class="btn">Clear '+ model.done +' completed '+(model.done == 1 ? 'item' : 'items')+'</button></a>'
      }
      str = str + '<div class="todo-count"><b>'+ model.remaining +'</b> '+(model.remaining == 1 ? 'item' : 'items' )+' left</div>'
      str = str + '<div id="credits">Created by Eoin Murray. Source on <a class="external" href="http://github.com/eoinmurray"><i class="icon-github "></i></a></div>'
      return str
      },

      events: {
        "keypress #new-todo":  "createOnEnter",
        "click .save": "createOnSave",
        "click #clear-completed": "clearCompleted",
        "click #toggle-all": "toggleAllComplete",
        "click .external" : 'external'
      },

      initialize: function() {
        this.model = new Bookmark()
        this.model.details_from_chrome()
        this.model.on('change', function(){
          this.render()
        }, this)

        this.input = this.$("#new-todo");
        this.input_url = this.$("#url");
        
        this.allCheckbox = this.$("#toggle-all")[0];

        Bookmarks.on('add', this.addOne, this);
        Bookmarks.on('reset', this.addAll, this);
        Bookmarks.on('all', this.render, this);

        this.footer = this.$('footer');
        this.main = $('#main');

        Bookmarks.fetch();
      },

      render: function() {
        var done = Bookmarks.done().length;
        var remaining = Bookmarks.remaining().length;
        this.input.val(this.model.get('title'))
        this.input_url.text(this.model.get('url')||'the url will appear here')

        if (Bookmarks.length) {
          
          this.main.show();
          this.footer.show();
          this.footer.html(this.statsTemplate({done: done, remaining: remaining}));
        } else {
          this.main.hide();
          this.footer.hide();
        }

        this.allCheckbox.checked = !remaining;
      },

      // Add a single todo item to the list by creating a view for it, and
      // appending its element to the `<ul>`.
      addOne: function(bookmark) {
        var view = new BookmarkView({model: bookmark});
        this.$("#todo-list").append(view.render().el);
      },

      // Add all items in the **Todos** collection at once.
      addAll: function() {
        Bookmarks.each(this.addOne, this);
      },

      // If you hit return in the main input field, create new **Todo** model,
      // persisting it to *localStorage*.
      createOnEnter: function(e) {
        if (e.keyCode != 13) return;
        if (!this.input.val()) return;
        console.log(this.model.get('url'))
        Bookmarks.create(this.model);
        this.render()
      },

      createOnSave: function(e) {
        e.preventDefault()
        if (!this.input.val()) return;
        Bookmarks.create(this.model);
        this.render()
      },

      // Clear all done todo items, destroying their models.
      clearCompleted: function() {
        _.invoke(Bookmarks.done(), 'destroy');
        return false;
      },

      toggleAllComplete: function () {
        var done = this.allCheckbox.checked;
        Bookmarks.each(function (bookmark) { bookmark.save({'done': done}); });
      },

      external: function(e){
        e.preventDefault()
        chrome.tabs.update(null, {url:e.currentTarget.href});
      }


  });

  var App = new AppView;

});



