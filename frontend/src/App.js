import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Grid, List, Edit3, X, Loader, CornerDownRight, AlertTriangle, XCircle, CheckCircle, Trash2 } from 'lucide-react';

// NOTE ON INSTALLATION:
// This component relies on the 'lucide-react' icon library.
// To run this locally, you must install it using npm or yarn:
// npm install lucide-react
// or
// yarn add lucide-react

// --- CONFIGURATION ---
// In a real project, these values would be loaded from environment variables (.env files).
const CONFIG = {
  // Backend endpoint to fetch live load cell weight data
  API_URL: "http://192.168.43.123:3001/weights", 
  // Key for storing product definitions in local storage
  LOCAL_STORAGE_KEY: "warehouseProducts",
  // How often to refresh data from the API (in milliseconds)
  REFRESH_INTERVAL_MS: 5000, 
};

const INITIAL_PRODUCTS = [
  {
    id: 1,
    name: 'Product A (Soda)',
    unit_weight: 350, // grams per unit
    from: 1,
    to: 5,
    warning: 10,
    alarm: 5,
    live_weight: 0,
    count: 0,
    status: 3,
  },
  {
    id: 2,
    name: 'Product B (Coffee Beans)',
    unit_weight: 1000,
    from: 6,
    to: 8,
    warning: 5,
    alarm: 2,
    live_weight: 0,
    count: 0,
    status: 3,
  },
  {
    id: 3,
    name: 'Product C (Bottled Water)',
    unit_weight: 600,
    from: 9,
    to: 12,
    warning: 15,
    alarm: 7,
    live_weight: 0,
    count: 0,
    status: 3,
  },
];

// Status mapping: 0: OK, 1: WARNING, 2: ALARM, 3: OUT_OF_STOCK
const STATUS_MAP = {
  0: { label: 'OK', color: 'bg-green-500', icon: CheckCircle, text: 'text-green-600' },
  1: { label: 'Warning', color: 'bg-yellow-400', icon: AlertTriangle, text: 'text-yellow-600' },
  2: { label: 'Alarm', color: 'bg-red-500', icon: XCircle, text: 'text-red-600' },
  3: { label: 'Out of Stock', color: 'bg-gray-400', icon: CornerDownRight, text: 'text-gray-600' },
};

// --- HELPER FUNCTIONS ---

/**
 * Calculates the status based on current count and thresholds.
 * @param {number} count The current calculated product count.
 * @param {number} warning The warning threshold.
 * @param {number} alarm The alarm threshold.
 * @returns {0|1|2|3} The status code.
 */
const calculateProductStatus = (count, warning, alarm) => {
  if (count <= 0) return 3; // Out of Stock
  if (count <= alarm) return 2; // Alarm
  if (count <= warning) return 1; // Warning
  return 0; // OK
};

/**
 * Loads products from local storage, or uses initial data if not found.
 * @returns {Array<Object>}
 */
const loadProductsFromStorage = () => {
  try {
    const stored = localStorage.getItem(CONFIG.LOCAL_STORAGE_KEY);
    return stored ? JSON.parse(stored) : INITIAL_PRODUCTS;
  } catch (e) {
    console.error("Failed to load products from localStorage, using default.", e);
    return INITIAL_PRODUCTS;
  }
};

/**
 * Saves the current products array to local storage.
 * @param {Array<Object>} products
 */
const saveProductsToStorage = (products) => {
  try {
    localStorage.setItem(CONFIG.LOCAL_STORAGE_KEY, JSON.stringify(products));
  } catch (e) {
    console.error("Failed to save products to localStorage.", e);
  }
};


// --- CUSTOM HOOK FOR DATA AND LOGIC ---

const useProductLogic = () => {
  const [products, setProducts] = useState(loadProductsFromStorage);
  const [loadCellData, setLoadCellData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Effect to save products whenever the state changes
  useEffect(() => {
    saveProductsToStorage(products);
  }, [products]);

  // Function to update product definitions (used by the Edit modal)
  const updateProductDefinition = useCallback((updatedProduct) => {
    setProducts(prevProducts =>
      prevProducts.map(p => (p.id === updatedProduct.id ? updatedProduct : p))
    );
  }, []);

  // Function to add a new product definition
  const addProductDefinition = useCallback((newProduct) => {
    setProducts(prevProducts => [
      ...prevProducts,
      {
        ...newProduct,
        id: Date.now(), // Simple unique ID
        live_weight: 0,
        count: 0,
        status: 3, // Default to Out of Stock
      }
    ]);
  }, []);

  // Function to delete a product definition
  const deleteProductDefinition = useCallback((productId) => {
    setProducts(prevProducts => prevProducts.filter(p => p.id !== productId));
  }, []);

  // Memoized function to calculate weights and status based on current live data
  const calculatedProducts = useMemo(() => {
    if (loadCellData.length === 0) return products;

    return products.map(product => {
      // 1. Calculate live weight by summing load cells from 'from' to 'to' (inclusive)
      const live_weight = loadCellData.reduce((sum, cell) => {
        if (cell.load_cell_id >= product.from && cell.load_cell_id <= product.to) {
          // Ensure weight is a number and not negative
          return sum + Math.max(0, parseFloat(cell.weight || 0));
        }
        return sum;
      }, 0);

      // 2. Calculate count, ensuring we don't divide by zero
      const count = product.unit_weight > 0
        ? Math.floor(live_weight / product.unit_weight)
        : 0;

      // 3. Determine status
      const status = calculateProductStatus(count, product.warning, product.alarm);

      return {
        ...product,
        live_weight: live_weight.toFixed(2),
        count,
        status,
      };
    });
  }, [products, loadCellData]);

  // Effect for continuous data fetching
  useEffect(() => {
    let active = true;
    const fetchData = async () => {
      if (!active) return;
      setIsLoading(true);
      setError(null);
      try {
        // Implementing exponential backoff logic for robust fetching
        const maxRetries = 3;
        let delay = 1000;

        for (let i = 0; i < maxRetries; i++) {
          try {
            const response = await fetch(CONFIG.API_URL); // <-- USING CONFIG.API_URL
            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            if (active) {
              setLoadCellData(data);
              setError(null); // Clear error on successful fetch
              setIsLoading(false);
            }
            return; // Success, exit loop
          } catch (err) {
            if (i === maxRetries - 1) {
              // Last retry failed
              if (active) {
                console.error("Final attempt failed to fetch live data:", err);
                setError("Failed to connect to backend service after multiple retries.");
                setIsLoading(false);
              }
              return;
            }
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2; // Exponential backoff
          }
        }
      } catch (err) {
        if (active) {
          console.error("Error during initial fetch/setup:", err);
          setError("Failed to connect to backend service.");
          setIsLoading(false);
        }
      } finally {
        // Note: setIsLoading(false) is handled inside the try/catch loop now
      }
    };

    fetchData(); // Initial fetch
    // Use the configured interval
    const interval = setInterval(fetchData, CONFIG.REFRESH_INTERVAL_MS); 

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  return {
    calculatedProducts,
    isLoading,
    error,
    updateProductDefinition,
    addProductDefinition,
    deleteProductDefinition, 
    products, 
  };
};

// --- UI COMPONENTS (Internal) ---

const StatusLED = ({ status }) => {
  const { color } = STATUS_MAP[status];
  return <div className={`h-4 w-4 rounded-full ${color} shadow-lg`} title={STATUS_MAP[status].label}></div>;
};

const DashboardHeader = ({ onViewToggle, currentView, onAddProduct }) => (
  <header className="flex flex-col sm:flex-row justify-between items-center p-4 bg-white shadow-md rounded-xl mb-6">
    <h1 className="text-3xl font-extrabold text-gray-800 mb-4 sm:mb-0">Inventory Dashboard</h1>
    <div className="flex space-x-3">
      <button
        onClick={onAddProduct}
        className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 transition duration-150"
        title="Add New Product"
      >
        <Plus size={20} />
        <span className="hidden sm:inline">Add Product</span>
      </button>
      <button
        onClick={onViewToggle}
        className="p-3 bg-gray-200 text-gray-800 rounded-lg shadow-md hover:bg-gray-300 transition duration-150"
        title={currentView === 'grid' ? 'Switch to List View' : 'Switch to Grid View'}
      >
        {currentView === 'grid' ? <List size={24} /> : <Grid size={24} />}
      </button>
    </div>
  </header>
);

const ConfirmationModal = ({ isOpen, title, message, onConfirm, onCancel }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 transform transition-all duration-300 scale-100">
        <div className="flex justify-between items-center border-b pb-3 mb-4">
          <h2 className="text-xl font-bold text-red-700 flex items-center"><AlertTriangle className="w-6 h-6 mr-2 text-red-500" />{title}</h2>
          <button onClick={onCancel} className="text-gray-500 hover:text-gray-700 p-1 rounded-full bg-gray-100"><X size={20} /></button>
        </div>
        <p className="text-gray-700 mb-6">{message}</p>
        <div className="flex justify-end space-x-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 bg-gray-200 font-semibold rounded-lg hover:bg-gray-300 transition duration-150"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-red-600 text-white font-semibold rounded-lg shadow-md hover:bg-red-700 transition duration-150 flex items-center"
          >
            <Trash2 className="w-4 h-4 mr-1"/>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

const ProductFormModal = ({ product, onClose, onSave }) => {
  const isEditing = !!product;
  const initialData = product || {
    name: '',
    unit_weight: 0,
    from: 1,
    to: 1,
    warning: 10,
    alarm: 5,
  };

  const [formData, setFormData] = useState(initialData);
  const [formError, setFormError] = useState('');

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    let finalValue = value;

    if (type === 'number') {
      // Allow empty string for temporary user input
      if (value === "") {
        finalValue = value;
      } else {
        // Ensure non-negative numbers for number inputs
        finalValue = parseFloat(value) >= 0 ? parseFloat(value) : 0;
      }
    }
    setFormData(prev => ({ ...prev, [name]: finalValue }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (formData.from > formData.to) {
      setFormError("'From' load cell ID must be less than or equal to 'To' load cell ID.");
      return;
    }
    if (formData.alarm >= formData.warning) {
      setFormError("Alarm threshold must be strictly less than Warning threshold.");
      return;
    }
    if (formData.unit_weight <= 0) {
      setFormError("Unit Weight must be greater than zero.");
      return;
    }

    onSave(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 transform transition-all duration-300">
        <div className="flex justify-between items-center border-b pb-3 mb-4">
          <h2 className="text-2xl font-bold text-gray-800">{isEditing ? 'Edit Product' : 'Add New Product'}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 p-1 rounded-full bg-gray-100"><X size={24} /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && <p className="text-red-500 bg-red-100 p-3 rounded-lg text-sm">{formError}</p>}
          
          <Input label="Product Name" name="name" value={formData.name} onChange={handleChange} required type="text" />
          <Input label="Unit Weight (grams)" name="unit_weight" value={formData.unit_weight} onChange={handleChange} required type="number" min="1" />
          
          <div className="flex space-x-4">
            <Input label="Load Cell From ID" name="from" value={formData.from} onChange={handleChange} required type="number" min="1" max="32" />
            <Input label="Load Cell To ID" name="to" value={formData.to} onChange={handleChange} required type="number" min="1" max="32" />
          </div>

          <div className="flex space-x-4">
            <Input label="Warning Threshold (Count)" name="warning" value={formData.warning} onChange={handleChange} required type="number" min="1" />
            <Input label="Alarm Threshold (Count)" name="alarm" value={formData.alarm} onChange={handleChange} required type="number" min="0" />
          </div>

          <div className="pt-4 flex justify-end">
            <button
              type="submit"
              className="px-6 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 transition duration-150"
            >
              {isEditing ? 'Save Changes' : 'Create Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const Input = ({ label, name, value, onChange, type = 'text', required = false, min }) => (
  <div>
    <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <input
      id={name}
      name={name}
      type={type}
      value={value}
      onChange={onChange}
      required={required}
      min={min}
      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
    />
  </div>
);

const ProductListItem = ({ product, onEdit, onDelete }) => {
  const { label, text } = STATUS_MAP[product.status];
  const Icon = STATUS_MAP[product.status].icon;
  const countColor = product.status === 2 ? 'text-red-500 font-bold' : (product.status === 1 ? 'text-yellow-500 font-semibold' : 'text-gray-800');

  return (
    <tr className="border-b hover:bg-gray-50 transition duration-100">
      <td className="p-4 whitespace-nowrap text-sm font-medium text-gray-900">{product.name}</td>
      <td className="p-4 whitespace-nowrap text-sm text-gray-500">
        {product.from} - {product.to}
      </td>
      <td className="p-4 whitespace-nowrap text-sm text-gray-500">{product.unit_weight} g</td>
      <td className="p-4 whitespace-nowrap text-sm text-gray-500">{product.live_weight} g</td>
      <td className={`p-4 whitespace-nowrap text-base ${countColor}`}>
        {product.count} units
      </td>
      <td className="p-4 whitespace-nowrap text-sm">
        <div className="flex items-center space-x-2">
          <StatusLED status={product.status} />
          <span className={`${text} hidden sm:inline`}>{label}</span>
        </div>
      </td>
      <td className="p-4 whitespace-nowrap text-right text-sm font-medium">
        <div className="flex justify-end space-x-2">
            <button
              onClick={() => onEdit(product)}
              className="text-indigo-600 hover:text-indigo-900 p-2 rounded-full hover:bg-indigo-50 transition duration-150"
              title="Edit Product"
            >
              <Edit3 size={18} />
            </button>
            <button
              onClick={() => onDelete(product)}
              className="text-red-500 hover:text-red-700 p-2 rounded-full hover:bg-red-50 transition duration-150"
              title="Delete Product"
            >
              <Trash2 size={18} />
            </button>
        </div>
      </td>
    </tr>
  );
};

const ProductGridItem = ({ product, onEdit, onDelete }) => {
  const { label, color, text } = STATUS_MAP[product.status];
  const Icon = STATUS_MAP[product.status].icon;
  const bgColor = product.status === 2 ? 'bg-red-100' : (product.status === 1 ? 'bg-yellow-100' : (product.status === 0 ? 'bg-green-100' : 'bg-gray-100'));
  const ringColor = product.status === 2 ? 'ring-red-300' : (product.status === 1 ? 'ring-yellow-300' : (product.status === 0 ? 'ring-green-300' : 'ring-gray-300'));

  const countColor = product.status === 2 ? 'text-red-600 font-extrabold' : (product.status === 1 ? 'text-yellow-600 font-bold' : 'text-gray-800 font-bold');


  return (
    <div className={`p-6 rounded-xl shadow-lg border-2 ${bgColor} ${ringColor} ring-2 transition-all duration-300 transform hover:scale-[1.02]`}>
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-xl font-extrabold text-gray-900 truncate">{product.name}</h3>
        <div className="flex space-x-1">
            <button
              onClick={() => onEdit(product)}
              className="text-gray-500 hover:text-indigo-600 p-1 rounded-full transition duration-150"
              title="Edit Product"
            >
              <Edit3 size={18} />
            </button>
            <button
              onClick={() => onDelete(product)}
              className="text-gray-500 hover:text-red-600 p-1 rounded-full transition duration-150"
              title="Delete Product"
            >
              <Trash2 size={18} />
            </button>
        </div>
      </div>

      <div className="mb-4">
        <p className="text-xs font-semibold uppercase text-gray-500">Current Stock</p>
        <div className="flex items-center mt-1">
          <p className={`text-4xl ${countColor}`}>{product.count}</p>
          <span className="ml-2 text-xl text-gray-600">units</span>
        </div>
      </div>

      <div className="space-y-2 text-sm text-gray-700">
        <div className="flex justify-between border-t pt-2">
            <span className="font-medium text-xs uppercase">Location</span>
            <span className="font-semibold text-gray-800">{product.from} - {product.to}</span>
        </div>
        <div className="flex justify-between">
            <span className="font-medium text-xs uppercase">Live Weight</span>
            <span className="font-semibold">{product.live_weight} g</span>
        </div>
        <div className="flex justify-between">
            <span className="font-medium text-xs uppercase">Unit Weight</span>
            <span className="font-semibold">{product.unit_weight} g</span>
        </div>
        <div className="flex justify-between">
            <span className="font-medium text-xs uppercase">Warning / Alarm</span>
            <span className="font-semibold">{product.warning} / {product.alarm}</span>
        </div>
      </div>

      <div className={`mt-4 pt-3 border-t-2 ${ringColor} flex items-center justify-center space-x-2 `}>
        <Icon className={`w-5 h-5 ${text}`} />
        <span className={`text-base font-semibold ${text}`}>{label}</span>
      </div>
    </div>
  );
};

// --- MAIN APPLICATION COMPONENT ---

const App = () => {
  const { calculatedProducts, isLoading, error, updateProductDefinition, addProductDefinition, deleteProductDefinition, products: originalProducts } = useProductLogic();
  const [view, setView] = useState('grid'); // 'grid' or 'list'
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [productToEdit, setProductToEdit] = useState(null);
  
  // State for deletion confirmation
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState(null);

  const handleEditClick = (product) => {
    setProductToEdit(product);
    setIsEditModalOpen(true);
  };

  const handleSaveProduct = (formData) => {
    if (productToEdit) {
      updateProductDefinition(formData);
    } else {
      addProductDefinition(formData);
    }
  };

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setProductToEdit(null);
  };
  
  // --- Deletion Handlers ---
  const handleDeleteClick = (product) => {
    setProductToDelete(product);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = () => {
    if (productToDelete) {
      deleteProductDefinition(productToDelete.id);
    }
    setIsDeleteModalOpen(false);
    setProductToDelete(null);
  };

  const handleCancelDelete = () => {
    setIsDeleteModalOpen(false);
    setProductToDelete(null);
  };
  // -------------------------

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-8 font-sans">
      <DashboardHeader
        onViewToggle={() => setView(view === 'grid' ? 'list' : 'grid')}
        currentView={view}
        onAddProduct={() => handleEditClick(null)}
      />

      {(isLoading && calculatedProducts.length === 0) && (
        <div className="flex items-center justify-center p-8 bg-white rounded-xl shadow-lg">
          <Loader className="animate-spin text-indigo-600 mr-3" />
          <p className="text-lg text-gray-600">Connecting to load cells...</p>
        </div>
      )}

      {error && (
        <div className="p-4 mb-6 bg-red-100 border-l-4 border-red-500 text-red-700 rounded-lg shadow-md">
          <p className="font-bold">Connection Error</p>
          <p>{error}</p>
        </div>
      )}

      {calculatedProducts.length === 0 ? (
        <div className="p-8 text-center bg-white rounded-xl shadow-lg">
          <p className="text-xl text-gray-600">No products defined yet.</p>
          <p className="text-gray-500 mt-2">Use the "Add Product" button to set up your inventory locations.</p>
        </div>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {calculatedProducts.map(product => (
            <ProductGridItem 
                key={product.id} 
                product={product} 
                onEdit={handleEditClick} 
                onDelete={handleDeleteClick}
            />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto bg-white rounded-xl shadow-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="p-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Product Name
                </th>
                <th scope="col" className="p-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Load Cells
                </th>
                <th scope="col" className="p-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Unit Weight
                </th>
                <th scope="col" className="p-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Live Weight
                </th>
                <th scope="col" className="p-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Count
                </th>
                <th scope="col" className="p-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th scope="col" className="relative p-4">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {calculatedProducts.map(product => (
                <ProductListItem 
                    key={product.id} 
                    product={product} 
                    onEdit={handleEditClick} 
                    onDelete={handleDeleteClick}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isEditModalOpen && (
        <ProductFormModal
          product={productToEdit || null}
          onClose={handleCloseEditModal}
          onSave={handleSaveProduct}
        />
      )}
      
      {isDeleteModalOpen && productToDelete && (
        <ConfirmationModal
          isOpen={isDeleteModalOpen}
          title="Confirm Deletion"
          message={`Are you sure you want to permanently delete the product definition for "${productToDelete.name}"? This action cannot be undone.`}
          onConfirm={handleConfirmDelete}
          onCancel={handleCancelDelete}
        />
      )}
      
      {/* Footer / Status Indicator */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-800 text-white p-3 text-center text-xs shadow-inner flex justify-center items-center space-x-4">
          <span className="font-semibold">Live Data Status:</span>
          {error ? (
              <span className="flex items-center space-x-1 text-red-400">
                  <XCircle size={14} /> <span>Disconnected</span>
              </span>
          ) : (
              <span className="flex items-center space-x-1 text-green-400">
                  <CheckCircle size={14} className={isLoading ? 'animate-pulse' : ''} />
                  <span>{isLoading ? 'Fetching...' : 'Connected'}</span>
              </span>
          )}
          <span className="text-gray-400 hidden sm:inline">| Updates every {CONFIG.REFRESH_INTERVAL_MS / 1000} seconds.</span>
      </div>
    </div>
  );
};

export default App;