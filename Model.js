(function(angular, undefined){'use strict';

	//Declaration of the error message minification service
	var $resourceMinErr = angular.$$minErr('$resource');

	/**
	 * Create a shallow copy of an object and clear other fields from the destination
	 */
	function shallowClearAndCopy(src, dst) {
	  
	  //If Destination is not given it is set to an empty object.
	  dst = dst || {};

	  //Goes through the destination object deleting all of its properties
	  angular.forEach(dst, function(value, key) {
	    delete dst[key];
	  });

	  //Goes through all the properties of the source object to copy them to the destination
	  for (var key in src) {

	    //Before setting the destination property ir checks if it is a property of the source object itself
	    //and if it is nor a property like "$$somethin"
	      if (src.hasOwnProperty(key) && !(key.charAt(0) === '$' && key.charAt(1) === '$')) {

	          if (typeof(src[key]) && /^\d{4}-\d{2}-\d{2}/.test(src[key])) {
	              dst[key] = new Date(src[key]);
	          } else {
	              dst[key] = src[key];
	          }	      
	    }
	  }

	  //Return the destination object
	  return dst;
	}
	
	//Module Model
	angular.module("Model", [])

	//Model service
    .provider('Model', Provider);

    //Provider function
    function Provider(){

    	//Sets the provider variable to this object
    	var provider = this;

    	//Protocol used to make the calls
    	provider.protocol = 'http';

    	//Base domain for all requests. It can replaced with a new url when creatign a new instance of the model.
    	provider.domain = 'localhost';

        //Base URL for all requests. It can replaced with a new url when creatign a new instance of the model.
    	provider.mainUrl = "";

    	//Port to be used for the calls
    	provider.port = '80';

    	//Default time out
    	provider.timeout = undefined;

    	//Default property to be treated as the identifier for the resource
    	//If the identification is composed by the name of the resource the string "{{name}}" can be used as a 
    	//placeholder for the resource name. And it will be replaced in runtime for the resource name
    	provider.id = 'id';

    	//Default parameter that will be send in every request
    	provider.params = {};

    	//Property that tells if the list of resource instancies shoul be loaded right away or not
    	//The default is true
    	provider.eager = true;

    	//Default success function
    	provider.success = function (value, response, action, name, config) {};

    	//Default error function
    	provider.error = function (reason, action, name, config) {};

    	//Actions of this provider
    	provider.actions = {    		
	        'get': {method: 'GET'},
	        'save': {method: 'POST', operation: 'ADD'},
	        'query': {method: 'GET', isArray: true},
	        'remove': {method: 'DELETE', operation: 'REMOVE'},
	        'delete': {method: 'DELETE', operation: 'REMOVE'},
	        'update': {method: 'PUT'}
    	}

    	//Function to put a url together acording to the context of the call
    	function makeUrl(config, data, params) {

    		//Initializes the url variable as an empty string
    		var url = '';

    		//First adds the protocol. (By default is going to be http, but it can be overriden in the config fase)
    		url+=config.protocol || provider.protocol;

    		//Then it adds the required sequence of caracters after the protocoll '://'
    		url+='://';

    		//Then the domain name that can be overriden in the config fase. The default is localhost
    		url+=config.domain || provider.domain;

    		//Then it adds the require character ':' before the port number
    		url+=':';

    		//Then the port number, that can also be overriden in the config fase. The defalt is port 80
    		url+=config.port || provider.port;
    		
    		//Then it adds the require character '/' before the resource name
    		url += '/';

    	    //Then it adds the require character '/' before the resource name
    		url += config.mainUrl || provider.mainUrl;

    	    //Then it adds the require character '/' before the resource name
    		url += '/';

    		//The it adds the resource name
    		url+=config.name;

    		//If the data argument is passed, and 
    		if (data && data[config.id]) {

				//Then it adds the require character '/' before the resource identification
				url+='/';

				//The it adds the resource identification
				url+=data[config.id];
    		} else if (params && params[config.id]) {
    		    //Then it adds the require character '/' before the resource identification
    		    url += '/';

    		    //The it adds the resource identification
    		    url += params[config.id];
    		}

    		return url;
    	}

    	//The factory function
    	provider.$get = Factory;

    	//Annotattion to inject the $http angular service in the Factory function
    	Factory.$inject = ['$http'];

    	//Factory to create the model service
	    function Factory ($http) {

	    	//Function to that receives an array of config objects and create all models
	    	function ModelService(configArray) {

	    		//Function to return the model service
				function ModelServiceSingle(config) {

					//Sets the property that will be treated as the identification for the resource
					//If no property is specified in the config object the provider default will be used
					//just replacing the placeholder "{{config}}" for the resource config object
					config.id = config.id || provider.id.replace(/{{(.*)}}/g, function (_,expression) {
						
						//TODO - For the expression to be correctly evaluated the minified code should provide 
						//the 'config' object with the config name, there may be a better way of doing this.

						//executes the javascript expression with the result of the evaluation
						//of the expression.
						//The expression must be inside the string given in the provider configuration
						//surraunded by {{}} the expression will have access to the "config" variable
						//and can access every property given for the especifc model
						//for example the "config.name"
						return eval(expression);
					});

					//Property that tells if the list of resource instancies shoul be loaded right away or not
					config.eager = config.eager !== undefined ? config.eager : provider.eager;

					//Function to construct each model instance
					function Resource (value) {

						//Sets and replace the properties on the resource with the values passed as parameters
						shallowClearAndCopy(value || {}, this);

						//TODO - Look for the best way to control the status of the comunication
						this.$status = "OK";
					}
					
					//Sets the name of the id property for future reference
					Resource.$idProperty = config.id;

					//Sets the list attribute of the resource object
					//This attribute will maintain a list of the resource instances
					//generally acquired via the query action, or any other
					//action that returns an array.
					Resource.list = [];

					//Sets the property that references the currently selected resource instance
					Resource.selected = new Resource();

					//Clears the currently selected item
					Resource.clear = function () {
						Resource.selected = new Resource();
					}

					//Sets the selected item with the argument
					Resource.select = function (item) {
						if (item instanceof Resource) {	
							Resource.selected = item;
						} else {
							throw new Error("The argument passed is not an instance of the Resource function.");
						};
					}

					//Same select method to be called from the instance
					Resource.prototype.$select = function () {
						Resource.selected = this;
					}

					//Runs though the actions object
					angular.forEach(provider.actions, function (action, name) {

						//The only http methods that have bodies are:
						//POST, PUT and PATCH, so it is hardcoded a Regex to check if the currente actions is one of these methods
						//if so it sets the hasBody flag as true, otherwise it is set to false
						var hasBody = /^(POST|PUT|PATCH)$/i.test(action.method);

						//For each actions it sets a function with the actions name
						Resource[name] = function (a1, a2, a3, a4) {

							//Declare the local variables
							//params: The object with the parameters to be passed
							//data: The data object to sent
							//succes: The callback to be called in case of success
							//error: The callback to be called in case of an error occurs
							var params = {}, data, success, error;


							//Switch case that assign the arguments to the respective variables depending on the number of arguments passed

							/* jshint -W086 */ /* (purposefully fall through case statements) */
							switch (arguments.length) {

								//In case of 4 arguments passed
								case 4:
									//The error callback will be the fourth argument
									error = a4;

									//The success callbac will be the third argument
									success = a3;

									//And it falls through the cases to assign the first and second arguments  

									//fallthrough
								case 3:
								case 2:

									//Checks if argument 2 is a function
									if (angular.isFunction(a2)) {

										//If arguments 1 and 2 are functions...
										if (angular.isFunction(a1)) {
											//Then a1 is the success callback
											success = a1;
											//And a2 is the error callback
											error = a2;

											//And since a3 and a4 can only be callbacks as well no further checking is done
											//and it breaks out of the switch block
											break;
										}

										//If a2 is a function and a1 is not...

										//a2 is the one that represents the success callback...
										success = a2;

										//and a3 is the error callback, whether it is defined or not
										error = a3;

										//And falls through the the cases to assign the first argument to its variable

										//fallthrough
									} else {

										//Now, if a2 is not a function...

										//a1 is the parameters
										params = a1;

										//a2 is the data
										data = a2;

										//and a3 is the succes callback
										success = a3;

										//And it breaks out of the switch statement
										break;
									}

								//At last, in case of only one parameter is passed, or the cases have fallen here to assingn the a1 argument...
								case 1:

									//It set a1 to the success function if it is a function
									if (angular.isFunction(a1)) success = a1;

									//If a1 is not a function and the flag hasBody is set to true, a1 is the data to be passed
									else if (hasBody) data = a1;

									//Otherwise, a1 is the params object
									else params = a1;

									//And it breaks out of the switch statement
									break;

								//In case of no arguments are passed, no variable is assigned any value
								case 0: break;

								//If more than 4 arguments are passed the error is thrown
								default:
									throw $resourceMinErr('badargs',
									"Expected up to 4 arguments [params, data, success, error], got {0} arguments",
									arguments.length);
							}

							//Every time an action is executed on a resource the selected item is cleared
							Resource.selected = new Resource();

							//Sets a variable value with the data in case it is an instance call
							//If it is not an instance call and the action isArray is set to true the value variable is set to an empty array
							//Otherwise it is set to a Resource instance with the data properties
							var value = this instanceof Resource ? data : (action.isArray ? [] : new Resource(data));

							//TODO - Look for the best way to control the status of the comunication
							value.$status = "AG";

							//If the operation of the action is set to ADD, then the value is added to the list
							if (action.operation === "ADD") {
								
								//Function that checks if a list item is equal to the instance object
							    var contains = function (listItem){
									return angular.equals(listItem ,this);
								}
								
								//If it can not find the index of the value in the list
								//it adds it to the list
								if(Resource.list.findIndex(contains, value) === -1){
									Resource.list.push(value);	
								};		
								
							};

							//Sets a httpConfig to an empty object
							var httpConfig = {};

							//Runs through all of the action properties
							angular.forEach(action, function(value, key) {

								//There are three properties that are not treated as $http.config, so it tests if the property is not one of those
								if (key != 'params' 
									&& key != 'isArray' 
									&& key != 'interceptor'
									&& key != 'operation') {

									//And if it is not a special property it sets the httpConfig object with the properties in the action object
									httpConfig[key] = angular.copy(value);
								}
							});

							//Mounts the url acorrdding to the context
							httpConfig.url = makeUrl(config, data, params);

							//Sets the timeout
							httpConfig.timeout = config.timeout || provider.timeout;

							//Sets the params for the request
							httpConfig.params = angular.extend({}, (params || {}), (config.params || {}), (provider.params || {}));

							//Sets the data to be passed in the request
							httpConfig.data = data;
							
							//Starts an http call using the httpConfig object as the http config object
							$http(httpConfig).then(function Success (response) {

								//The variable data is set to the data property on the response
								var dataResponse = response.data;

								//If the data is a valid object...
								if (dataResponse) {

									//Checks if the data is what was expected (Array or Object)
									// Need to convert action.isArray to boolean in case it is undefined
									// jshint -W018
									if (angular.isArray(dataResponse) !== (!!action.isArray)) {
										throw $resourceMinErr('badcfg',
											'Error in resource configuration for action `{0}`. Expected response to ' +
											'contain an {1} but got an {2} (Request: {3} {4})', name, action.isArray ? 'array' : 'object',
											angular.isArray(dataResponse) ? 'array' : 'object', httpConfig.method, httpConfig.url);
									}
									// jshint +W018

									//If data is an array ...
									if (action.isArray) {

										//Sets the length to 0
										value.length = 0;

										//Runs through each item in the array...
										angular.forEach(dataResponse, function(item) {

											//And if it is of type object...
											if (typeof item === "object") {

												//Creates a Resource instance and pushes it to the value array
												value.push(new Resource(item));

											} else {
												//Otherwise just push it to the value array

												// Valid JSON values may be string literals, and these should not be converted
												// into objects. These items will not have access to the Resource prototype
												// methods, but unfortunately there
												value.push(item);
											};
										});

										Resource.list = value;								
									} 
									//If data is not an array...
									else {
										//Copies the properties from the data object to the value
										shallowClearAndCopy(dataResponse, value);

										//If the operation of the action is set to REMOVE
										if (action.operation === "REMOVE") {
											//First it gets the index of the value
						                    var index = Resource.list.indexOf(value);

						                    //And then removes it from the list
						                    Resource.list.splice(index, 1);
										};
									}
								}

								//TODO - Look for the best way to control the status of the comunication
								value.$status = "OK";

								//TODO - Currently all of the success functions are being called, maybe an override system should be interesting
								//that allows chainning the success functions

								//Calls the success function given in the method call passing the value and the response headers
								(success || angular.noop)(value, response, action, name, config);

								//Calls the success function given in the config object
								(config.success || angular.noop)(value, response, action, name, config);

								//Calls the success function in the provider
								(provider.success || angular.noop)(value, response, action, name, config);

							}, function Error (reason) {

								//TODO - Look for the best way to control the status of the comunication
								value.$status = "ER";

								//Calls the error callback or an empty function passing the response
								(error || angular.noop)(reason);

								//Calls the error function given in the config object
								(config.error || angular.noop)(reason, action, name, config);

								//Calls the error function in the provider
								(provider.error || angular.noop)(reason, action, name, config);
							});

							return value;
						}

						//After setting the actions on the contructor object it also sets on the prototype
						//but this time with the firs character '$'
						//this will be used to make the instace calls
						//Notice that here only three arguments are passed
						//Becouse the resource instance will be used as the data itself
						Resource.prototype['$' + name] = function(params, success, error) {

							//If params is a function it means that only the success and possibily the error callbacks were passed
							if (angular.isFunction(params)) {
								error = success; success = params; params = {};
							}

							//It makes a call to the constructor action using this instance as the context object and as the data object
							//and saves the returned value in a variable result
							var result = Resource[name].call(this, params, this, success, error);

							//If the $promise is set in the result object it is returned otherwise the entire object is returned
							return result;
						};
					});

					//If eager is set to true, the list is loaded right away
					if (config.eager) {
						Resource.list = Resource.query();
					};

					//Gets the name of the model
					var name = config.name;

					//Sets the model as a property of the Model Service
					ModelService[name] = Resource;
					
					//Sets the has one relationship
					angular.forEach(config.hasOne, function(relation){
						if(ModelService[relation.model]){
							console.log("model")
						} else {
							throw new Error("No model "+relation.model+" was loaded yet. Verify the loading order of your models.")
						}
						console.log(relation);
					});

					//Returns the Resource
					return ModelService[name];
				};

				//Runs through the array of config objects and create the models by calling the ModelServiceSingle function
				angular.forEach(configArray, function (config){
					ModelServiceSingle(config);
				});
	    	}			

			//Returns the model service to the creator
	    	return ModelService;
	    };
    };

})(window.angular)