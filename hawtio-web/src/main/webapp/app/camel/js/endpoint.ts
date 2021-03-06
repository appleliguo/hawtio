module Camel {
  export function EndpointController($scope, $location, workspace:Workspace, jolokia) {
    $scope.workspace = workspace;
    $scope.message = "";
    $scope.selectedComponentName = null;
    $scope.endpointParameters = {};
    $scope.schema = {
      definitions: {
      }
    };

    var silentOptions = {silent: true};

    $scope.$watch('workspace.selection', function () {
      workspace.moveIfViewInvalid();
      loadData();
    });

    $scope.$watch('selectedComponentName', () => {
      if ($scope.selectedComponentName !== $scope.loadedComponentName) {
        $scope.endpointParameters = {};
        loadEndpointSchema($scope.selectedComponentName);
        $scope.loadedComponentName = $scope.selectedComponentName;
      }
    });

    $scope.createEndpoint = (name) => {
      var jolokia = workspace.jolokia;
      if (jolokia) {
        var mbean = getSelectionCamelContextMBean(workspace);
        if (mbean) {
          $scope.message = "Creating endpoint " + name;
          var operation = "createEndpoint(java.lang.String)";
          jolokia.execute(mbean, operation, name, onSuccess(operationSuccess));
        } else {
          notification("error", "Could not find the CamelContext MBean!");
        }
      }
    };

    $scope.createEndpointFromData = () => {
      if ($scope.selectedComponentName && $scope.endpointPath) {
        var name = $scope.selectedComponentName + "://" + $scope.endpointPath;
        console.log("Have endpoint data " + JSON.stringify($scope.endpointParameters));

        var params = "";
        angular.forEach($scope.endpointParameters, (value, key) => {
          var prefix = params ? "&" : "";
          params += prefix + key + "=" + value;
        });
        if (params) {
          name += "?" + params;
        }
        // TODO use form data too for URIs parameters...
        $scope.createEndpoint(name);
      }
    };

    $scope.deleteEndpoint = () => {
      var jolokia = workspace.jolokia;
      var selection = workspace.selection;
      var entries = selection.entries;
      if (selection && jolokia && entries) {
        var domain = selection.domain;
        var brokerName = entries["BrokerName"];
        var name = entries["Destination"];
        var isQueue = "Topic" !== entries["Type"];
        if (domain && brokerName) {
          var mbean = "" + domain + ":BrokerName=" + brokerName + ",Type=Broker";
          $scope.message = "Deleting " + (isQueue ? "queue" : "topic") + " " + name;
          var operation = "removeEndpoint(java.lang.String)";
          jolokia.execute(mbean, operation, name, onSuccess(deleteSuccess));
        }
      }
    };

    $scope.endpointCompletions = () => {
      var answer = [];
      var mbean = Camel.getSelectionCamelContextMBean(workspace);
      var componentName = $scope.selectedComponentName;
      var endpointParameters = {};
      var completionText = $scope.endpointPath || "";
      if (mbean && componentName && completionText) {
        answer = jolokia.execute(mbean, 'completeEndpointPath', componentName, endpointParameters, completionText, onSuccess(null, silentOptions));
      }
      return answer;
    };

    function loadData() {
      $scope.componentNames = null;
      var mbean = Camel.getSelectionCamelContextMBean(workspace);
      if (mbean) {
        jolokia.execute(mbean, 'findComponentNames', onSuccess(onComponents, silentOptions));
      }
    }

    function onComponents(response) {
      $scope.componentNames = response;
      $scope.hasComponentNames = $scope.componentNames ? true : false;
      Core.$apply($scope);
    }

    function loadEndpointSchema(componentName) {
      var mbean = Camel.getSelectionCamelContextMBean(workspace);
      if (mbean && componentName) {
        jolokia.execute(mbean, 'componentParameterJsonSchema', componentName, onSuccess(onEndpointSchema, silentOptions));
      }
    }

    function onEndpointSchema(response) {
      if (response) {
        try {
          //console.log("got JSON: " + response);
          var json = JSON.parse(response);
          $scope.endpointSchema = json;
          $scope.schema.definitions[$scope.selectedComponentName] = json;
          Core.$apply($scope);
        } catch (e) {
          console.log("Failed to parse JSON " + e);
          console.log("JSON: " + response);
        }
      }
    }

    function operationSuccess() {
      $scope.endpointName = "";
      $scope.workspace.operationCounter += 1;
      $scope.$apply();
      notification("success", $scope.message);
    }

    function deleteSuccess() {
      // lets set the selection to the parent
      if (workspace.selection) {
        var parent = workspace.selection.parent;
        if (parent) {
          $scope.workspace.updateSelectionNode(parent);
        }
      }
      $scope.workspace.operationCounter += 1;
      $scope.$apply();
      notification("success", $scope.message);
    }
  }
}
