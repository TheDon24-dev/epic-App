import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import { Trash2, ShoppingBag } from 'lucide-react';

export const Cart = () => {
  const { cart, updateQuantity, removeFromCart, total } = useCart();
  const { userProfile } = useAuth();
  const navigate = useNavigate();

  if (cart.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <ShoppingBag className="mx-auto h-24 w-24 text-gray-300 mb-6" />
        <h2 className="text-3xl font-extrabold text-gray-900 mb-4">Your cart is empty</h2>
        <p className="text-lg text-gray-500 mb-8">Looks like you haven't added anything to your cart yet.</p>
        <Link
          to="/"
          className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
        >
          Start Shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-extrabold text-gray-900 mb-8">Shopping Cart</h1>
      
      <div className="lg:grid lg:grid-cols-12 lg:gap-x-12 lg:items-start">
        <div className="lg:col-span-8">
          <ul className="border-t border-b border-gray-200 divide-y divide-gray-200">
            {cart.map((item) => (
              <li key={item.id} className="flex py-6 sm:py-10">
                <div className="flex-shrink-0">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-24 h-24 rounded-md object-center object-cover sm:w-32 sm:h-32"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-24 h-24 sm:w-32 sm:h-32 bg-gray-200 rounded-md flex items-center justify-center text-gray-400">
                      No Image
                    </div>
                  )}
                </div>

                <div className="ml-4 flex-1 flex flex-col justify-between sm:ml-6">
                  <div className="relative pr-9 sm:grid sm:grid-cols-2 sm:gap-x-6 sm:pr-0">
                    <div>
                      <div className="flex justify-between">
                        <h3 className="text-sm">
                          <Link to={`/products/${item.id}`} className="font-medium text-gray-700 hover:text-gray-800">
                            {item.name}
                          </Link>
                        </h3>
                      </div>
                      <div className="mt-1 flex text-sm">
                        <p className="text-gray-500">{item.category}</p>
                      </div>
                      <p className="mt-1 text-sm font-medium text-gray-900">${item.price.toFixed(2)}</p>
                    </div>

                    <div className="mt-4 sm:mt-0 sm:pr-9">
                      <label htmlFor={`quantity-${item.id}`} className="sr-only">
                        Quantity, {item.name}
                      </label>
                      <select
                        id={`quantity-${item.id}`}
                        name={`quantity-${item.id}`}
                        className="max-w-full rounded-md border border-gray-300 py-1.5 text-base leading-5 font-medium text-gray-700 text-left shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        value={item.cartQuantity}
                        onChange={(e) => updateQuantity(item.id!, Number(e.target.value))}
                      >
                        {[...Array(Math.min(10, item.inventory))].map((_, i) => (
                          <option key={i + 1} value={i + 1}>
                            {i + 1}
                          </option>
                        ))}
                      </select>

                      <div className="absolute top-0 right-0">
                        <button
                          type="button"
                          className="-m-2 p-2 inline-flex text-gray-400 hover:text-gray-500"
                          onClick={() => removeFromCart(item.id!)}
                        >
                          <span className="sr-only">Remove</span>
                          <Trash2 className="h-5 w-5" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <p className="mt-4 flex text-sm text-gray-700 space-x-2">
                    {item.inventory > 0 ? (
                      <span className="text-green-500">In stock</span>
                    ) : (
                      <span className="text-red-500">Out of stock</span>
                    )}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <section aria-labelledby="summary-heading" className="mt-16 bg-gray-50 rounded-lg px-4 py-6 sm:p-6 lg:p-8 lg:mt-0 lg:col-span-4">
          <h2 id="summary-heading" className="text-lg font-medium text-gray-900">
            Order summary
          </h2>

          <dl className="mt-6 space-y-4">
            <div className="flex items-center justify-between">
              <dt className="text-sm text-gray-600">Subtotal</dt>
              <dd className="text-sm font-medium text-gray-900">${total.toFixed(2)}</dd>
            </div>
            <div className="border-t border-gray-200 pt-4 flex items-center justify-between">
              <dt className="flex items-center text-sm text-gray-600">
                <span>Shipping estimate</span>
              </dt>
              <dd className="text-sm font-medium text-gray-900">$5.00</dd>
            </div>
            <div className="border-t border-gray-200 pt-4 flex items-center justify-between">
              <dt className="flex text-sm text-gray-600">
                <span>Tax estimate</span>
              </dt>
              <dd className="text-sm font-medium text-gray-900">${(total * 0.08).toFixed(2)}</dd>
            </div>
            <div className="border-t border-gray-200 pt-4 flex items-center justify-between">
              <dt className="text-base font-medium text-gray-900">Order total</dt>
              <dd className="text-base font-medium text-gray-900">${(total + 5 + total * 0.08).toFixed(2)}</dd>
            </div>
          </dl>

          <div className="mt-6">
            <button
              onClick={() => {
                if (!userProfile) {
                  alert("Please sign in to checkout");
                  return;
                }
                navigate('/checkout');
              }}
              className="w-full bg-indigo-600 border border-transparent rounded-md shadow-sm py-3 px-4 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-50 focus:ring-indigo-500"
            >
              Checkout
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};
