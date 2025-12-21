import React, { useState } from 'react';
import { Heart, Coffee, Server, Zap, Users, ChevronRight } from 'lucide-react';
import MetaTags from '../components/MetaTags';

const DonatePage = () => {
  const [selectedAmount, setSelectedAmount] = useState(null);
  const [customAmount, setCustomAmount] = useState('');

  // Preset donation amounts
  const donationAmounts = [
    { amount: 5, label: '☕ One Coffee', description: 'Buy us a coffee!' },
    { amount: 10, label: '☕☕ Two Coffees', description: 'Keep us caffeinated!' },
    { amount: 25, label: '🍕 Pizza Party', description: 'Fuel a late-night coding session!' },
    { amount: 50, label: '⚡ Power Boost', description: 'Help cover server costs!' },
  ];

  // What donations help with
  const supportItems = [
    {
      icon: Server,
      title: 'Server Costs',
      description: 'Hosting, CDN, and database expenses',
      color: 'text-blue-500'
    },
    {
      icon: Coffee,
      title: 'Development',
      description: 'Coffee and late-night coding sessions',
      color: 'text-orange-500'
    },
    {
      icon: Zap,
      title: 'New Features',
      description: 'Tools, builders, and improvements',
      color: 'text-yellow-500'
    },
    {
      icon: Users,
      title: 'Community',
      description: 'Keeping this passion project alive',
      color: 'text-purple-500'
    },
  ];

  const handleDonate = (method) => {
    const amount = selectedAmount || parseFloat(customAmount) || 5;

    // TODO: Replace with actual payment integration
    if (method === 'stripe') {
      alert(`Stripe integration coming soon! Amount: $${amount}`);
      // window.location.href = `https://donate.stripe.com/...?amount=${amount}`;
    } else if (method === 'paypal') {
      alert(`PayPal integration coming soon! Amount: $${amount}`);
      // window.location.href = `https://www.paypal.com/donate?...&amount=${amount}`;
    } else if (method === 'kofi') {
      alert(`Ko-fi integration coming soon! Amount: $${amount}`);
      // window.open('https://ko-fi.com/yourkofi', '_blank');
    }
  };

  return (
    <>
      <MetaTags
        title="Support Us"
        description="Help keep the Slayer Legend Wiki online! This is a self-funded passion project for the community."
        url="/donate"
        image="/images/og-default.svg"
        keywords={['donate', 'support', 'contribute', 'help', 'community']}
      />

      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="max-w-4xl mx-auto px-4 py-12">
          {/* Header with coffee cup */}
          <div className="text-center mb-12">
            <div className="inline-block mb-6 animate-bounce">
              <div className="text-8xl filter drop-shadow-lg">☕</div>
            </div>

            <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-4">
              Support Our Wiki
            </h1>

            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto leading-relaxed">
              This wiki is a <span className="font-semibold text-blue-600 dark:text-blue-400">self-funded passion project</span> created
              and maintained by community members. Every contribution helps keep the servers running and
              allows us to continue improving the wiki for everyone!
            </p>
          </div>

          {/* Stats/Impact Section */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 mb-12">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 text-center">
              💖 Your Support Helps With
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {supportItems.map((item, index) => {
                const IconComponent = item.icon;
                return (
                  <div
                    key={index}
                    className="flex items-start space-x-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <div className={`${item.color} mt-1`}>
                      <IconComponent className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                        {item.title}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        {item.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Donation Amount Selection */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 mb-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
              Choose Your Contribution
            </h2>

            {/* Preset Amounts */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              {donationAmounts.map((option) => (
                <button
                  key={option.amount}
                  onClick={() => {
                    setSelectedAmount(option.amount);
                    setCustomAmount('');
                  }}
                  className={`p-4 rounded-xl border-2 transition-all transform hover:scale-105 ${
                    selectedAmount === option.amount
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-lg'
                      : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700'
                  }`}
                >
                  <div className="text-left">
                    <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                      ${option.amount}
                    </div>
                    <div className="text-sm font-semibold text-blue-600 dark:text-blue-400 mb-1">
                      {option.label}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      {option.description}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Custom Amount */}
            <div className="mb-8">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Or enter a custom amount:
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400 text-lg font-semibold">
                  $
                </span>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  placeholder="25.00"
                  value={customAmount}
                  onChange={(e) => {
                    setCustomAmount(e.target.value);
                    setSelectedAmount(null);
                  }}
                  className="w-full pl-10 pr-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:bg-gray-700 dark:text-white text-lg"
                />
              </div>
            </div>

            {/* Payment Methods */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Choose Payment Method:
              </h3>

              {/* Stripe */}
              <button
                onClick={() => handleDonate('stripe')}
                disabled={!selectedAmount && !customAmount}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold py-4 px-6 rounded-xl shadow-lg transition-all transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-between group"
              >
                <span className="flex items-center space-x-3">
                  <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z"/>
                  </svg>
                  <span>Pay with Stripe</span>
                </span>
                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>

              {/* PayPal */}
              <button
                onClick={() => handleDonate('paypal')}
                disabled={!selectedAmount && !customAmount}
                className="w-full bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold py-4 px-6 rounded-xl shadow-lg transition-all transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-between group"
              >
                <span className="flex items-center space-x-3">
                  <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106zm14.146-14.42a3.35 3.35 0 0 0-.607-.541c-.013.076-.026.175-.041.254-.93 4.778-4.005 7.201-9.138 7.201h-2.19a.563.563 0 0 0-.556.479l-1.187 7.527h-.506l-.24 1.516a.56.56 0 0 0 .554.647h3.882c.46 0 .85-.334.922-.788.06-.26.76-4.852.816-5.09a.932.932 0 0 1 .923-.788h.58c3.76 0 6.705-1.528 7.565-5.946.36-1.847.174-3.388-.777-4.471z"/>
                  </svg>
                  <span>Pay with PayPal</span>
                </span>
                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>

              {/* Ko-fi */}
              <button
                onClick={() => handleDonate('kofi')}
                className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold py-4 px-6 rounded-xl shadow-lg transition-all transform hover:scale-[1.02] flex items-center justify-between group"
              >
                <span className="flex items-center space-x-3">
                  <Coffee className="w-6 h-6" />
                  <span>Support on Ko-fi</span>
                </span>
                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>

          {/* Thank You Message */}
          <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl shadow-xl p-8 text-white text-center">
            <Heart className="w-12 h-12 mx-auto mb-4" />
            <h3 className="text-2xl font-bold mb-2">
              Thank You for Your Support!
            </h3>
            <p className="text-lg opacity-90">
              Every contribution, big or small, helps keep this community resource alive and thriving.
              You're awesome! 🎉
            </p>
          </div>

          {/* Footer Info */}
          <div className="mt-8 text-center text-sm text-gray-600 dark:text-gray-400">
            <p>
              All donations go directly towards server costs and development.
              This wiki is run by volunteers and is not affiliated with the game developers.
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default DonatePage;
