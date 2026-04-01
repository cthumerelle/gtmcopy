<template>
  <div class="container mx-auto px-4 py-8">
    <h1 class="text-2xl font-bold text-gray-900 mb-6">Copy GTM Elements</h1>
    
    <div v-if="error" class="mb-6 p-4 bg-red-100 text-red-800 rounded-md">
      {{ error }}
    </div>
    
    <!-- Wizard steps navigation -->
    <div class="mb-8">
      <ol class="flex items-center w-full text-sm font-medium text-center text-gray-500 sm:text-base">
        <li 
          v-for="(step, index) in steps" 
          :key="index"
          :class="[
            'flex md:w-full items-center',
            index !== steps.length - 1 ? 'after:content-[\'\'] after:w-full after:h-1 after:border-b after:border-gray-200 after:border-1 after:hidden sm:after:inline-block after:mx-6 xl:after:mx-10' : '',
            currentStep >= index ? 'text-primary-600' : 'text-gray-500'
          ]"
        >
          <span 
            class="flex items-center justify-center w-8 h-8 mr-2 text-xs border rounded-full shrink-0"
            :class="currentStep >= index ? 'border-primary-600 text-primary-600' : 'border-gray-500 text-gray-500'"
          >
            {{ index + 1 }}
          </span>
          {{ step }}
        </li>
      </ol>
    </div>

    <div class="card">
      <!-- Step 1: Select source -->
      <div v-if="currentStep === 0" class="space-y-6">
        <h2 class="text-xl font-semibold text-gray-800 mb-4">Step 1: Select Source</h2>
        
        <div v-if="loading" class="flex justify-center py-12">
          <div class="animate-spin h-8 w-8 text-primary-600">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        </div>
        
        <div v-else>
          <!-- Account selection -->
          <div class="form-group">
            <label for="source-account" class="form-label">GTM Account</label>
            <select 
              id="source-account" 
              v-model="source.accountId" 
              @change="handleAccountChange" 
              class="form-input"
            >
              <option value="">Select an account</option>
              <option 
                v-for="account in gtmStore.accounts" 
                :key="account.accountId" 
                :value="account.accountId"
              >
                {{ account.name }}
              </option>
            </select>
          </div>
          
          <!-- Container selection (shown after account selection) -->
          <div v-if="source.accountId" class="form-group">
            <label for="source-container" class="form-label">GTM Container</label>
            <select 
              id="source-container" 
              v-model="source.containerId" 
              @change="handleContainerChange" 
              class="form-input"
            >
              <option value="">Select a container</option>
              <option 
                v-for="container in gtmStore.containers" 
                :key="container.containerId" 
                :value="container.containerId"
              >
                {{ container.name }} ({{ container.publicId }})
              </option>
            </select>
          </div>
          
          <!-- Workspace selection (shown after container selection) -->
          <div v-if="source.containerId" class="form-group">
            <label for="source-workspace" class="form-label">Workspace</label>
            <select 
              id="source-workspace" 
              v-model="source.workspaceId" 
              @change="handleWorkspaceChange" 
              class="form-input"
            >
              <option value="">Select a workspace</option>
              <option 
                v-for="workspace in gtmStore.workspaces" 
                :key="workspace.workspaceId" 
                :value="workspace.workspaceId"
              >
                {{ workspace.name }}
              </option>
            </select>
          </div>
          
          <div v-if="source.workspaceId" class="mt-8">
            <button @click="nextStep" class="btn-primary">Next: Select Elements</button>
          </div>
        </div>
      </div>
      
      <!-- Step 2: Select elements -->
      <div v-else-if="currentStep === 1" class="space-y-6">
        <h2 class="text-xl font-semibold text-gray-800 mb-4">Step 2: Select Elements</h2>
        
        <div v-if="loading" class="flex justify-center py-12">
          <div class="animate-spin h-8 w-8 text-primary-600">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        </div>
        
        <div v-else>
          <!-- Global element selection controls -->
          <div class="flex items-center space-x-4 mb-6">
            <button 
              @click="selectAllElements" 
              class="text-sm text-primary-600 hover:text-primary-800"
            >
              Select All Elements
            </button>
            <button 
              @click="deselectAllElements" 
              class="text-sm text-primary-600 hover:text-primary-800"
            >
              Deselect All Elements
            </button>
          </div>
          
          <!-- Templates section -->
          <div v-if="gtmStore.templates.length > 0" class="mb-8">
            <div class="flex items-center justify-between mb-2">
              <h3 class="font-medium text-gray-700">
                Custom Templates 
                <span class="text-sm text-gray-500">({{ selectedElements.templates.length }} / {{ gtmStore.templates.length }} selected)</span>
              </h3>
              <div class="flex items-center space-x-2">
                <button
                  @click="selectAllOfType('templates')"
                  class="text-xs text-primary-600 hover:text-primary-800"
                >
                  Select All
                </button>
                <button
                  @click="deselectAllOfType('templates')"
                  class="text-xs text-primary-600 hover:text-primary-800"
                >
                  Deselect All
                </button>
              </div>
            </div>
            
            <div class="bg-gray-50 p-4 rounded-md mb-4 max-h-60 overflow-y-auto">
              <div v-for="template in gtmStore.templates" :key="template.templateId" class="flex items-center mb-2 last:mb-0">
                <input 
                  :id="`template-${template.templateId}`" 
                  type="checkbox"
                  v-model="selectedElements.templates"
                  :value="template.templateId"
                  class="checkbox"
                />
                <label
                  :for="`template-${template.templateId}`"
                  class="ml-2 text-sm"
                  :class="getChangeStatus('templates', template.templateId) === 'deleted' ? 'line-through text-gray-400' : 'text-gray-700'"
                >
                  {{ template.name }}
                </label>
                <span
                  v-if="getChangeStatus('templates', template.templateId)"
                  class="ml-2 text-xs px-1.5 py-0.5 rounded font-medium"
                  :class="changeBadgeClass(getChangeStatus('templates', template.templateId))"
                >
                  {{ changeBadgeLabel(getChangeStatus('templates', template.templateId)) }}
                </span>
              </div>
              <div v-if="gtmStore.templates.length === 0" class="text-sm text-gray-500 text-center py-2">
                No templates available
              </div>
            </div>
          </div>
          
          <!-- Tags section -->
          <div v-if="gtmStore.tags.length > 0" class="mb-8">
            <div class="flex items-center justify-between mb-2">
              <h3 class="font-medium text-gray-700">
                Tags 
                <span class="text-sm text-gray-500">({{ selectedElements.tags.length }} / {{ gtmStore.tags.length }} selected)</span>
              </h3>
              <div class="flex items-center space-x-2">
                <button
                  @click="selectAllOfType('tags')"
                  class="text-xs text-primary-600 hover:text-primary-800"
                >
                  Select All
                </button>
                <button
                  @click="deselectAllOfType('tags')"
                  class="text-xs text-primary-600 hover:text-primary-800"
                >
                  Deselect All
                </button>
              </div>
            </div>
            
            <div class="bg-gray-50 p-4 rounded-md mb-4 max-h-60 overflow-y-auto">
              <div v-for="tag in gtmStore.tags" :key="tag.tagId" class="flex items-center mb-2 last:mb-0">
                <input 
                  :id="`tag-${tag.tagId}`" 
                  type="checkbox"
                  v-model="selectedElements.tags"
                  :value="tag.tagId"
                  class="checkbox"
                />
                <label
                  :for="`tag-${tag.tagId}`"
                  class="ml-2 text-sm"
                  :class="getChangeStatus('tags', tag.tagId) === 'deleted' ? 'line-through text-gray-400' : 'text-gray-700'"
                >
                  {{ tag.name }}
                </label>
                <span
                  v-if="getChangeStatus('tags', tag.tagId)"
                  class="ml-2 text-xs px-1.5 py-0.5 rounded font-medium"
                  :class="changeBadgeClass(getChangeStatus('tags', tag.tagId))"
                >
                  {{ changeBadgeLabel(getChangeStatus('tags', tag.tagId)) }}
                </span>
              </div>
              <div v-if="gtmStore.tags.length === 0" class="text-sm text-gray-500 text-center py-2">
                No tags available
              </div>
            </div>
          </div>
          
          <!-- Triggers section -->
          <div v-if="gtmStore.triggers.length > 0" class="mb-8">
            <div class="flex items-center justify-between mb-2">
              <h3 class="font-medium text-gray-700">
                Triggers 
                <span class="text-sm text-gray-500">({{ selectedElements.triggers.length }} / {{ gtmStore.triggers.length }} selected)</span>
              </h3>
              <div class="flex items-center space-x-2">
                <button
                  @click="selectAllOfType('triggers')"
                  class="text-xs text-primary-600 hover:text-primary-800"
                >
                  Select All
                </button>
                <button
                  @click="deselectAllOfType('triggers')"
                  class="text-xs text-primary-600 hover:text-primary-800"
                >
                  Deselect All
                </button>
              </div>
            </div>
            
            <div class="bg-gray-50 p-4 rounded-md mb-4 max-h-60 overflow-y-auto">
              <div v-for="trigger in gtmStore.triggers" :key="trigger.triggerId" class="flex items-center mb-2 last:mb-0">
                <input 
                  :id="`trigger-${trigger.triggerId}`" 
                  type="checkbox"
                  v-model="selectedElements.triggers"
                  :value="trigger.triggerId"
                  class="checkbox"
                />
                <label
                  :for="`trigger-${trigger.triggerId}`"
                  class="ml-2 text-sm"
                  :class="getChangeStatus('triggers', trigger.triggerId) === 'deleted' ? 'line-through text-gray-400' : 'text-gray-700'"
                >
                  {{ trigger.name }}
                </label>
                <span
                  v-if="getChangeStatus('triggers', trigger.triggerId)"
                  class="ml-2 text-xs px-1.5 py-0.5 rounded font-medium"
                  :class="changeBadgeClass(getChangeStatus('triggers', trigger.triggerId))"
                >
                  {{ changeBadgeLabel(getChangeStatus('triggers', trigger.triggerId)) }}
                </span>
              </div>
              <div v-if="gtmStore.triggers.length === 0" class="text-sm text-gray-500 text-center py-2">
                No triggers available
              </div>
            </div>
          </div>
          
          <!-- Variables section -->
          <div v-if="gtmStore.variables.length > 0" class="mb-8">
            <div class="flex items-center justify-between mb-2">
              <h3 class="font-medium text-gray-700">
                Variables 
                <span class="text-sm text-gray-500">({{ selectedElements.variables.length }} / {{ gtmStore.variables.length }} selected)</span>
              </h3>
              <div class="flex items-center space-x-2">
                <button
                  @click="selectAllOfType('variables')"
                  class="text-xs text-primary-600 hover:text-primary-800"
                >
                  Select All
                </button>
                <button
                  @click="deselectAllOfType('variables')"
                  class="text-xs text-primary-600 hover:text-primary-800"
                >
                  Deselect All
                </button>
              </div>
            </div>
            
            <div class="bg-gray-50 p-4 rounded-md mb-4 max-h-60 overflow-y-auto">
              <div v-for="variable in gtmStore.variables" :key="variable.variableId" class="flex items-center mb-2 last:mb-0">
                <input 
                  :id="`variable-${variable.variableId}`" 
                  type="checkbox"
                  v-model="selectedElements.variables"
                  :value="variable.variableId"
                  class="checkbox"
                />
                <label
                  :for="`variable-${variable.variableId}`"
                  class="ml-2 text-sm"
                  :class="getChangeStatus('variables', variable.variableId) === 'deleted' ? 'line-through text-gray-400' : 'text-gray-700'"
                >
                  {{ variable.name }}
                </label>
                <span
                  v-if="getChangeStatus('variables', variable.variableId)"
                  class="ml-2 text-xs px-1.5 py-0.5 rounded font-medium"
                  :class="changeBadgeClass(getChangeStatus('variables', variable.variableId))"
                >
                  {{ changeBadgeLabel(getChangeStatus('variables', variable.variableId)) }}
                </span>
              </div>
              <div v-if="gtmStore.variables.length === 0" class="text-sm text-gray-500 text-center py-2">
                No variables available
              </div>
            </div>
          </div>
          
          <!-- Clients section (server-side containers only) -->
          <div v-if="gtmStore.clients.length > 0" class="mb-8">
            <div class="flex items-center justify-between mb-2">
              <h3 class="font-medium text-gray-700">
                Clients
                <span class="text-sm text-gray-500">({{ selectedElements.clients.length }} / {{ gtmStore.clients.length }} selected)</span>
              </h3>
              <div class="flex items-center space-x-2">
                <button
                  @click="selectAllOfType('clients')"
                  class="text-xs text-primary-600 hover:text-primary-800"
                >
                  Select All
                </button>
                <button
                  @click="deselectAllOfType('clients')"
                  class="text-xs text-primary-600 hover:text-primary-800"
                >
                  Deselect All
                </button>
              </div>
            </div>

            <div class="bg-gray-50 p-4 rounded-md mb-4 max-h-60 overflow-y-auto">
              <div v-for="client in gtmStore.clients" :key="client.clientId" class="flex items-center mb-2 last:mb-0">
                <input
                  :id="`client-${client.clientId}`"
                  type="checkbox"
                  v-model="selectedElements.clients"
                  :value="client.clientId"
                  class="checkbox"
                />
                <label
                  :for="`client-${client.clientId}`"
                  class="ml-2 text-sm"
                  :class="getChangeStatus('clients', client.clientId) === 'deleted' ? 'line-through text-gray-400' : 'text-gray-700'"
                >
                  {{ client.name }}
                </label>
                <span
                  v-if="getChangeStatus('clients', client.clientId)"
                  class="ml-2 text-xs px-1.5 py-0.5 rounded font-medium"
                  :class="changeBadgeClass(getChangeStatus('clients', client.clientId))"
                >
                  {{ changeBadgeLabel(getChangeStatus('clients', client.clientId)) }}
                </span>
              </div>
            </div>
          </div>

          <!-- Transformations section -->
          <div v-if="gtmStore.transformations.length > 0" class="mb-8">
            <div class="flex items-center justify-between mb-2">
              <h3 class="font-medium text-gray-700">
                Transformations 
                <span class="text-sm text-gray-500">({{ selectedElements.transformations.length }} / {{ gtmStore.transformations.length }} selected)</span>
              </h3>
              <div class="flex items-center space-x-2">
                <button
                  @click="selectAllOfType('transformations')"
                  class="text-xs text-primary-600 hover:text-primary-800"
                >
                  Select All
                </button>
                <button
                  @click="deselectAllOfType('transformations')"
                  class="text-xs text-primary-600 hover:text-primary-800"
                >
                  Deselect All
                </button>
              </div>
            </div>
            
            <div class="bg-gray-50 p-4 rounded-md mb-4 max-h-60 overflow-y-auto">
              <div v-for="transformation in gtmStore.transformations" :key="transformation.transformationId" class="flex items-center mb-2 last:mb-0">
                <input 
                  :id="`transformation-${transformation.transformationId}`" 
                  type="checkbox"
                  v-model="selectedElements.transformations"
                  :value="transformation.transformationId"
                  class="checkbox"
                />
                <label
                  :for="`transformation-${transformation.transformationId}`"
                  class="ml-2 text-sm"
                  :class="getChangeStatus('transformations', transformation.transformationId) === 'deleted' ? 'line-through text-gray-400' : 'text-gray-700'"
                >
                  {{ transformation.name }}
                </label>
                <span
                  v-if="getChangeStatus('transformations', transformation.transformationId)"
                  class="ml-2 text-xs px-1.5 py-0.5 rounded font-medium"
                  :class="changeBadgeClass(getChangeStatus('transformations', transformation.transformationId))"
                >
                  {{ changeBadgeLabel(getChangeStatus('transformations', transformation.transformationId)) }}
                </span>
              </div>
              <div v-if="gtmStore.transformations.length === 0" class="text-sm text-gray-500 text-center py-2">
                No transformations available
              </div>
            </div>
          </div>
          
          <div class="flex justify-between mt-8">
            <button @click="prevStep" class="btn-secondary">Back: Source Selection</button>
            <button 
              @click="nextStep" 
              class="btn-primary"
              :disabled="totalSelectedElements === 0"
            >
              Next: Select Targets
            </button>
          </div>
        </div>
      </div>
      
      <!-- Step 3: Select targets -->
      <div v-else-if="currentStep === 2" class="space-y-6">
        <h2 class="text-xl font-semibold text-gray-800 mb-4">Step 3: Select Target Containers</h2>
        
        <div v-if="loading" class="flex justify-center py-12">
          <div class="animate-spin h-8 w-8 text-primary-600">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        </div>
        
        <div v-else>
          <!-- Target account selection -->
          <div class="form-group">
            <label for="target-account" class="form-label">Target GTM Account</label>
            <select 
              id="target-account" 
              v-model="currentTarget.accountId" 
              @change="handleTargetAccountChange" 
              class="form-input"
            >
              <option value="">Select an account</option>
              <option 
                v-for="account in gtmStore.accounts" 
                :key="account.accountId" 
                :value="account.accountId"
              >
                {{ account.name }}
              </option>
            </select>
          </div>
          
          <!-- Target container selection -->
          <div v-if="currentTarget.accountId" class="form-group">
            <label for="target-container" class="form-label">Target Container</label>
            <select 
              id="target-container" 
              v-model="currentTarget.containerId" 
              class="form-input"
            >
              <option value="">Select a container</option>
              <option 
                v-for="container in targetContainers" 
                :key="container.containerId" 
                :value="container.containerId"
              >
                {{ container.name }} ({{ container.publicId }})
              </option>
            </select>
          </div>
          
          <!-- Add target button -->
          <div v-if="currentTarget.containerId" class="mt-4">
            <button @click="addTarget" class="btn-secondary">
              Add Target
            </button>
          </div>
          
          <!-- Selected targets list -->
          <div v-if="targets.length > 0" class="mt-8">
            <h3 class="font-medium text-gray-700 mb-4">Selected Targets:</h3>
            
            <div class="space-y-3">
              <div 
                v-for="(target, index) in targets" 
                :key="index"
                class="flex items-center justify-between p-3 bg-gray-50 rounded-md"
              >
                <div>
                  <div class="font-medium">
                    {{ getAccountName(target.accountId) }}
                  </div>
                  <div class="text-sm text-gray-600">
                    {{ getContainerName(target.containerId) }}
                  </div>
                </div>
                <button 
                  @click="removeTarget(index)" 
                  class="text-red-600 hover:text-red-800"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
          
          <div class="flex justify-between mt-8">
            <button @click="prevStep" class="btn-secondary">Back: Element Selection</button>
            <button 
              @click="nextStep" 
              class="btn-primary"
              :disabled="targets.length === 0"
            >
              Review and Copy
            </button>
          </div>
        </div>
      </div>
      
      <!-- Step 4: Review and copy -->
      <div v-else-if="currentStep === 3" class="space-y-6">
        <h2 class="text-xl font-semibold text-gray-800 mb-4">Step 4: Review and Copy</h2>
        
        <div v-if="copyInProgress" class="text-center py-12">
          <div class="flex justify-center mb-4">
            <div class="animate-spin h-10 w-10 text-primary-600">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          </div>
          <h3 class="text-lg font-medium mb-2">Copying in progress...</h3>
          <p class="text-gray-600">
            This may take a few minutes, depending on the number of elements being copied.
          </p>
        </div>
        
        <div v-else-if="copyCompleted" class="py-4">
          <div class="text-center mb-8">
            <div class="flex justify-center mb-4 text-green-500">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 class="text-lg font-medium mb-2">Copy Operation Complete!</h3>
          </div>
          
          <!-- Results summary -->
          <div v-for="(result, index) in copyResults.targets" :key="index" class="mb-6 p-4 bg-gray-50 rounded-md">
            <h4 class="font-medium mb-2 text-gray-800">
              Target: {{ getContainerName(result.targetContainer.containerId) }}
            </h4>
            
            <div v-if="result.status === 'failed'" class="p-3 bg-red-100 text-red-800 rounded-md mb-4">
              <p class="font-medium">Failed: {{ result.error }}</p>
            </div>
            
            <div v-else>
              <p class="mb-2">
                <span class="text-gray-600">Status:</span>
                <span
                  class="ml-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full"
                  :class="{
                    'bg-green-100 text-green-800': !result.errors,
                    'bg-yellow-100 text-yellow-800': result.errors && result.errors.length > 0
                  }"
                >
                  {{ !result.errors ? 'Success' : 'Partial' }}
                </span>
              </p>
              
              <p class="text-sm mb-1">
                <span class="text-gray-600">Elements copied:</span>
                <span class="ml-2 font-medium">{{ result.elements.copied }} / {{ result.elements.total }}</span>
              </p>
              
              <p class="text-sm">
                <span class="text-gray-600">Published:</span>
                <span class="ml-2 font-medium">{{ result.published ? 'Yes' : 'No' }}</span>
              </p>
              
              <div v-if="result.workspacePreserved" class="mt-2 p-3 bg-blue-50 text-blue-800 rounded-md">
                <p class="text-sm font-medium">🔍 Workspace disponible pour recette</p>
                <p class="text-xs mt-1">
                  Le workspace "{{ result.workspace?.name }}" a été créé avec les éléments copiés.
                  Vous pouvez le consulter dans GTM pour vérification avant publication manuelle.
                </p>
              </div>
              
              <div v-if="result.errors && result.errors.length > 0" class="mt-4">
                <p class="text-sm font-medium text-gray-700 mb-2">Errors:</p>
                <ul class="text-xs text-red-600 space-y-1 pl-4 list-disc">
                  <li v-for="(error, errorIndex) in result.errors" :key="errorIndex">
                    {{ error.type }}: {{ error.name ? error.name + ' - ' : '' }}{{ error.error }}
                  </li>
                </ul>
              </div>
            </div>
          </div>
          
          <div class="flex flex-col md:flex-row md:justify-between space-y-4 md:space-y-0 mt-8">
            <button @click="startNewCopy" class="btn-secondary">
              Start New Copy
            </button>
            <router-link to="/history" class="btn-primary">
              View Copy History
            </router-link>
          </div>
        </div>
        
        <div v-else>
          <!-- Review copy settings -->
          <div class="bg-gray-50 p-6 rounded-md mb-6">
            <h3 class="font-medium text-gray-700 mb-4">Copy Summary:</h3>
            
            <div class="space-y-4">
              <!-- Source details -->
              <div>
                <h4 class="text-sm text-gray-500 mb-1">Source:</h4>
                <p class="font-medium">
                  {{ getAccountName(source.accountId) }} / 
                  {{ getContainerName(source.containerId) }} / 
                  {{ getWorkspaceName(source.workspaceId) }}
                </p>
              </div>
              
              <!-- Selected elements summary -->
              <div>
                <h4 class="text-sm text-gray-500 mb-1">Selected Elements:</h4>
                <ul class="pl-5 list-disc space-y-1">
                  <li v-if="selectedElements.templates.length > 0" class="text-sm">
                    <span class="font-medium">Templates:</span> {{ selectedElements.templates.length }}
                  </li>
                  <li v-if="selectedElements.tags.length > 0" class="text-sm">
                    <span class="font-medium">Tags:</span> {{ selectedElements.tags.length }}
                  </li>
                  <li v-if="selectedElements.triggers.length > 0" class="text-sm">
                    <span class="font-medium">Triggers:</span> {{ selectedElements.triggers.length }}
                  </li>
                  <li v-if="selectedElements.variables.length > 0" class="text-sm">
                    <span class="font-medium">Variables:</span> {{ selectedElements.variables.length }}
                  </li>
                  <li v-if="selectedElements.clients.length > 0" class="text-sm">
                    <span class="font-medium">Clients:</span> {{ selectedElements.clients.length }}
                  </li>
                  <li v-if="selectedElements.transformations.length > 0" class="text-sm">
                    <span class="font-medium">Transformations:</span> {{ selectedElements.transformations.length }}
                  </li>
                </ul>
              </div>
              
              <!-- Targets -->
              <div>
                <h4 class="text-sm text-gray-500 mb-1">Targets ({{ targets.length }}):</h4>
                <ul class="pl-5 list-disc">
                  <li v-for="(target, index) in targets" :key="index" class="text-sm">
                    {{ getAccountName(target.accountId) }} / 
                    {{ getContainerName(target.containerId) }}
                  </li>
                </ul>
              </div>
            </div>
          </div>
          
          <!-- Deployment option -->
          <div class="mb-6 p-4 bg-blue-50 rounded-md">
            <div class="flex items-start">
              <div class="flex items-center h-5">
                <input 
                  id="auto-publish" 
                  type="checkbox"
                  v-model="autoPublish"
                  class="checkbox"
                />
              </div>
              <div class="ml-3">
                <label for="auto-publish" class="font-medium text-blue-800">
                  Publier automatiquement les workspaces
                </label>
                <p class="text-sm text-blue-700 mt-1">
                  Si décoché, les workspaces seront créés mais non publiés, vous permettant de les vérifier avant publication manuelle.
                </p>
              </div>
            </div>
          </div>
          
          <!-- Important notes -->
          <div class="mb-6 p-4 bg-yellow-50 text-yellow-800 rounded-md">
            <p class="font-medium mb-2">Important notes:</p>
            <ul class="pl-5 list-disc text-sm space-y-1">
              <li>This operation will create a temporary workspace in each target container.</li>
              <li>Elements with the same name in the target containers will be overwritten.</li>
              <li v-if="autoPublish">Changes will be published to the live containers automatically.</li>
              <li v-else>Workspaces will be created but not published, allowing manual review before going live.</li>
            </ul>
          </div>
          
          <div class="flex justify-between mt-8">
            <button @click="prevStep" class="btn-secondary">Back: Target Selection</button>
            <button @click="performCopy" class="btn-primary">Start Copy</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useGtmStore } from '../store/gtm';
import api from '../services/api';

const route = useRoute();
const gtmStore = useGtmStore();

// State
const steps = ['Select Source', 'Select Elements', 'Select Targets', 'Review & Copy'];
const currentStep = ref(0);
const loading = ref(false);
const error = ref(null);
const copyInProgress = ref(false);
const copyCompleted = ref(false);
const copyResults = ref(null);
const autoPublish = ref(true); // Par défaut, la publication automatique est activée

// Source selection
const source = ref({
  accountId: '',
  containerId: '',
  workspaceId: ''
});

// Selected individual elements
const selectedElements = ref({
  templates: [],
  tags: [],
  triggers: [],
  variables: [],
  clients: [],
  transformations: []
});

// Total selected elements across all types
const totalSelectedElements = computed(() => {
  return selectedElements.value.templates.length +
         selectedElements.value.tags.length +
         selectedElements.value.triggers.length +
         selectedElements.value.variables.length +
         selectedElements.value.clients.length +
         selectedElements.value.transformations.length;
});

// Target selection
const targets = ref([]);
const currentTarget = ref({
  accountId: '',
  containerId: ''
});

const targetContainers = computed(() => {
  if (!currentTarget.value.accountId) return [];
  
  // Filter out the source container to avoid copying to itself
  return gtmStore.containers.filter(container => {
    if (source.value.accountId === currentTarget.value.accountId &&
        source.value.containerId === container.containerId) {
      return false;
    }
    return true;
  });
});

// Element selection functions
function selectAllElements() {
  selectAllOfType('templates');
  selectAllOfType('tags');
  selectAllOfType('triggers');
  selectAllOfType('variables');
  selectAllOfType('clients');
  selectAllOfType('transformations');
}

function deselectAllElements() {
  deselectAllOfType('templates');
  deselectAllOfType('tags');
  deselectAllOfType('triggers');
  deselectAllOfType('variables');
  deselectAllOfType('clients');
  deselectAllOfType('transformations');
}

function selectAllOfType(type) {
  switch (type) {
    case 'templates':
      selectedElements.value.templates = gtmStore.templates.map(t => t.templateId);
      break;
    case 'tags':
      selectedElements.value.tags = gtmStore.tags.map(t => t.tagId);
      break;
    case 'triggers':
      selectedElements.value.triggers = gtmStore.triggers.map(t => t.triggerId);
      break;
    case 'variables':
      selectedElements.value.variables = gtmStore.variables.map(v => v.variableId);
      break;
    case 'clients':
      selectedElements.value.clients = gtmStore.clients.map(c => c.clientId);
      break;
    case 'transformations':
      selectedElements.value.transformations = gtmStore.transformations.map(t => t.transformationId);
      break;
  }
}

function deselectAllOfType(type) {
  switch (type) {
    case 'templates':
      selectedElements.value.templates = [];
      break;
    case 'tags':
      selectedElements.value.tags = [];
      break;
    case 'triggers':
      selectedElements.value.triggers = [];
      break;
    case 'variables':
      selectedElements.value.variables = [];
      break;
    case 'clients':
      selectedElements.value.clients = [];
      break;
    case 'transformations':
      selectedElements.value.transformations = [];
      break;
  }
}

// Flat lookup map computed once per workspace update: "type:id" → status
// Avoids repeated reactive traversal when template bindings call getChangeStatus multiple times per row.
const changeStatusCache = computed(() => {
  const wc = gtmStore.workspaceChanges;
  const cache = {};
  for (const [type, ids] of Object.entries(wc)) {
    for (const [id, status] of Object.entries(ids || {})) {
      cache[`${type}:${id}`] = status;
    }
  }
  return cache;
});

// Returns the changeStatus ('added', 'updated', 'deleted') for an element, or null
function getChangeStatus(type, id) {
  return changeStatusCache.value[`${type}:${id}`] || null;
}

function changeBadgeClass(status) {
  const map = {
    added:   'bg-green-100 text-green-800',
    updated: 'bg-blue-100 text-blue-800',
    deleted: 'bg-red-100 text-red-800',
  };
  return map[status] || '';
}

function changeBadgeLabel(status) {
  const map = {
    added:   'Nouveau',
    updated: 'Modifié',
    deleted: 'Suppression ⚠',
  };
  return map[status] || '';
}

// Pre-selects elements that have changes in the workspace.
// Called after loadSourceElements resolves.
function preSelectChangedElements() {
  const wc = gtmStore.workspaceChanges;
  if (!wc) return;
  const hasChanges = Object.values(wc).some(map => Object.keys(map).length > 0);
  if (!hasChanges) return;

  const idFields = {
    templates: 'templateId',
    tags: 'tagId',
    triggers: 'triggerId',
    variables: 'variableId',
    clients: 'clientId',
    transformations: 'transformationId',
  };

  const storeList = {
    templates: gtmStore.templates,
    tags: gtmStore.tags,
    triggers: gtmStore.triggers,
    variables: gtmStore.variables,
    clients: gtmStore.clients,
    transformations: gtmStore.transformations,
  };

  for (const [type, idField] of Object.entries(idFields)) {
    selectedElements.value[type] = storeList[type]
      .filter(el => wc[type]?.[el[idField]])
      .map(el => el[idField]);
  }
}

// Helper methods
function getAccountName(accountId) {
  const account = gtmStore.accounts.find(a => a.accountId === accountId);
  return account ? account.name : 'Unknown Account';
}

function getContainerName(containerId) {
  // We might need to fetch containers for the target account if not already loaded
  if (gtmStore.containers.length === 0) return 'Loading...';
  
  const container = gtmStore.containers.find(c => c.containerId === containerId);
  return container ? `${container.name} (${container.publicId})` : 'Unknown Container';
}

function getWorkspaceName(workspaceId) {
  const workspace = gtmStore.workspaces.find(w => w.workspaceId === workspaceId);
  return workspace ? workspace.name : 'Unknown Workspace';
}

// Event handlers
async function handleAccountChange() {
  if (!source.value.accountId) return;
  
  source.value.containerId = '';
  source.value.workspaceId = '';
  
  loading.value = true;
  try {
    await gtmStore.fetchContainers(source.value.accountId);
  } catch(err) {
    error.value = `Failed to load containers: ${err.message}`;
  } finally {
    loading.value = false;
  }
}

async function handleContainerChange() {
  if (!source.value.containerId) return;
  
  source.value.workspaceId = '';
  
  loading.value = true;
  try {
    await gtmStore.fetchWorkspaces(
      source.value.accountId, 
      source.value.containerId
    );
  } catch(err) {
    error.value = `Failed to load workspaces: ${err.message}`;
  } finally {
    loading.value = false;
  }
}

async function handleWorkspaceChange() {
  if (!source.value.workspaceId) return;
  
  // Save selection to store
  gtmStore.setSelectedSource(source.value);
}

async function handleTargetAccountChange() {
  if (!currentTarget.value.accountId) return;
  
  currentTarget.value.containerId = '';
  
  loading.value = true;
  try {
    await gtmStore.fetchContainers(currentTarget.value.accountId);
  } catch(err) {
    error.value = `Failed to load target containers: ${err.message}`;
  } finally {
    loading.value = false;
  }
}

function addTarget() {
  if (!currentTarget.value.accountId || !currentTarget.value.containerId) {
    return;
  }
  
  // Check if target already exists
  const targetExists = targets.value.some(t => 
    t.accountId === currentTarget.value.accountId && 
    t.containerId === currentTarget.value.containerId
  );
  
  if (!targetExists) {
    targets.value.push({
      accountId: currentTarget.value.accountId,
      containerId: currentTarget.value.containerId,
    });
    
    // Save selection to store
    gtmStore.addTarget({
      accountId: currentTarget.value.accountId,
      containerId: currentTarget.value.containerId,
    });
    
    // Reset current target for next addition
    currentTarget.value = {
      accountId: currentTarget.value.accountId,
      containerId: ''
    };
  }
}

function removeTarget(index) {
  const targetToRemove = targets.value[index];
  targets.value.splice(index, 1);
  
  // Update store
  gtmStore.removeTarget(targetToRemove);
}

function nextStep() {
  if (currentStep.value === 0) {
    // Fetch source elements before moving to step 2
    loadSourceElements();
  } else if (currentStep.value === 1) {
    // Save selected element types to store
    const activeElementTypes = [];
    if (selectedElements.value.templates.length > 0) activeElementTypes.push('templates');
    if (selectedElements.value.tags.length > 0) activeElementTypes.push('tags');
    if (selectedElements.value.triggers.length > 0) activeElementTypes.push('triggers');
    if (selectedElements.value.variables.length > 0) activeElementTypes.push('variables');
    if (selectedElements.value.clients.length > 0) activeElementTypes.push('clients');
    if (selectedElements.value.transformations.length > 0) activeElementTypes.push('transformations');

    // Save the selected element types
    gtmStore.setSelectedElementTypes(activeElementTypes);

    // Save the individual element selections for filtering on the backend
    // Use direct assignment as a workaround since the setter function might not be exposed properly
    gtmStore.selectedElements = selectedElements.value;
    
    // Move to next step
    currentStep.value += 1;
  } else if (currentStep.value < steps.length - 1) {
    currentStep.value += 1;
  }
}

function prevStep() {
  if (currentStep.value > 0) {
    currentStep.value -= 1;
  }
}

async function loadSourceElements() {
  loading.value = true;
  error.value = null;

  try {
    await gtmStore.fetchSourceElements();
    preSelectChangedElements();
    currentStep.value += 1;
  } catch(err) {
    error.value = `Failed to load source elements: ${err.message}`;
  } finally {
    loading.value = false;
  }
}

async function performCopy() {
  copyInProgress.value = true;
  error.value = null;

  try {
    // Separate deleted elements from create/update elements
    const wc = gtmStore.workspaceChanges;
    const idFields = {
      templates: { list: gtmStore.templates, id: 'templateId' },
      tags:      { list: gtmStore.tags,      id: 'tagId' },
      triggers:  { list: gtmStore.triggers,  id: 'triggerId' },
      variables: { list: gtmStore.variables, id: 'variableId' },
      clients:   { list: gtmStore.clients,   id: 'clientId' },
      transformations: { list: gtmStore.transformations, id: 'transformationId' },
    };

    const filteredSelectedElements = {};
    const deletedElementNames = {};

    for (const [type, { list, id }] of Object.entries(idFields)) {
      const deletedIds = Object.entries(wc[type] || {})
        .filter(([, s]) => s === 'deleted')
        .map(([elId]) => elId);

      filteredSelectedElements[type] = (selectedElements.value[type] || [])
        .filter(elId => !deletedIds.includes(elId));

      const selectedDeletedIds = (selectedElements.value[type] || [])
        .filter(elId => deletedIds.includes(elId));
      deletedElementNames[type] = selectedDeletedIds
        .map(elId => list.find(el => el[id] === elId)?.name)
        .filter(Boolean);
    }

    // Determine which element types to copy based on selections
    const activeElementTypes = [];
    if (filteredSelectedElements.templates?.length > 0) activeElementTypes.push('templates');
    if (filteredSelectedElements.tags?.length > 0) activeElementTypes.push('tags');
    if (filteredSelectedElements.triggers?.length > 0) activeElementTypes.push('triggers');
    if (filteredSelectedElements.variables?.length > 0) activeElementTypes.push('variables');
    if (filteredSelectedElements.clients?.length > 0) activeElementTypes.push('clients');
    if (filteredSelectedElements.transformations?.length > 0) activeElementTypes.push('transformations');

    // Save the active element types to the store
    gtmStore.setSelectedElementTypes(activeElementTypes);

    // Make sure the selected elements are up to date in the store
    gtmStore.selectedElements = { ...filteredSelectedElements };

    // Use the API service directly to ensure selections are passed correctly
    const response = await api.gtm.copyElements(
      gtmStore.selectedSource,
      gtmStore.selectedTargets,
      activeElementTypes,
      filteredSelectedElements,
      deletedElementNames,
      autoPublish.value
    );

    copyResults.value = response.data.result;
    copyCompleted.value = true;
  } catch(err) {
    error.value = `Copy operation failed: ${err.message}`;
  } finally {
    copyInProgress.value = false;
  }
}

function startNewCopy() {
  gtmStore.resetCopyStatus();
  copyCompleted.value = false;
  copyResults.value = null;
  currentStep.value = 0;
}

// Initialize component
onMounted(async () => {
  loading.value = true;
  
  try {
    // Fetch accounts if not already loaded
    if (gtmStore.accounts.length === 0) {
      await gtmStore.fetchAccounts();
    }
    
    // Check for account ID in query params
    if (route.query.accountId) {
      source.value.accountId = route.query.accountId;
      await handleAccountChange();
    }
    
    // Load previously selected source
    if (gtmStore.selectedSource.accountId) {
      source.value = { ...gtmStore.selectedSource };
      
      // Load containers and workspaces
      await gtmStore.fetchContainers(source.value.accountId);
      
      if (source.value.containerId) {
        await gtmStore.fetchWorkspaces(
          source.value.accountId, 
          source.value.containerId
        );
      }
    }
    
    // Load previously selected targets
    if (gtmStore.selectedTargets.length > 0) {
      targets.value = [...gtmStore.selectedTargets];
    }
    
    // Load previously selected elements
    if (gtmStore.selectedElements) {
      selectedElements.value = {
        templates: [],
        tags: [],
        triggers: [],
        variables: [],
        clients: [],
        transformations: [],
        ...gtmStore.selectedElements
      };
    }
    
  } catch (err) {
    error.value = `Failed to initialize: ${err.message}`;
  } finally {
    loading.value = false;
  }
});
</script>
