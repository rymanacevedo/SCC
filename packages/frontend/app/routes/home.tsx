import { NavLink } from 'react-router';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Create Your Professional Resume
          </h1>
          <p className="text-lg text-gray-600 mb-8">
            Get started with our easy-to-use resume builder.
          </p>
          <NavLink
            to="/info"
            className="inline-block px-8 py-4 bg-blue-600 text-white rounded-lg 
            text-lg font-semibold hover:bg-blue-700 transition-colors shadow-lg 
            hover:shadow-xl "
          >
            Create My Resume
          </NavLink>
        </div>
      </div>
    </div>
  );
}
