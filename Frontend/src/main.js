import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'

import { library } from '@fortawesome/fontawesome-svg-core'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import {
  faX,
  faUser,
  faRotateLeft,
  faMessage,
  faBriefcase,
  faCheck,
  faArrowLeft,
  faPlus,
  faPen,
  faTrash,
  faLocationDot,
  faBuilding,
  faSearch,
  faFilter,
  faSort,
  faCaretDown
} from '@fortawesome/free-solid-svg-icons'

library.add(faX, faUser, faRotateLeft, faMessage, faBriefcase, 
  faCheck, faArrowLeft, faPlus, faPen, faTrash, faLocationDot, 
  faBuilding, faSearch, faFilter, faSort, faCaretDown)

const app = createApp(App)
const pinia = createPinia()

app.component('FontAwesomeIcon', FontAwesomeIcon)

app.use(pinia)
app.use(router)
app.mount('#app')
