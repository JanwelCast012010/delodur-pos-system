# 🏪 DELODUR POS System

A modern Point of Sale (POS) system built with React, Node.js, and MySQL. This system provides a sleek, touch-friendly interface for retail operations with real-time inventory management.

## ✨ Features

### 🎯 **Modern POS Interface**
- **Dark Theme**: Luxurious automotive-inspired design with deep blacks and blue accents
- **Touch-Friendly**: Large buttons and controls optimized for retail use
- **Real-time Clock**: 12-hour format with live updates
- **Responsive Design**: Works on desktop, tablet, and mobile devices

### 📊 **Dashboard**
- **Live Statistics**: Total products, stock items, sales, and inventory value
- **Quick Actions**: Start sales, add products, view reports
- **Recent Activity**: System status and activity feed
- **Real-time Data**: Connected to your existing inventory database

### 🛒 **Sales Module**
- **Product Search**: Search by name or product code
- **Shopping Cart**: Add/remove items with quantity controls
- **Tax Calculation**: Automatic 12% tax computation
- **Philippine Peso**: Native ₱ currency support
- **Transaction Management**: Clear cart and complete sales

### 📦 **Inventory Management**
- **Stock Tracking**: Real-time stock levels
- **Product Management**: Add, edit, and manage products
- **Supplier Management**: Track suppliers and relationships
- **Reports**: Generate sales and inventory reports

## 🛠️ Technology Stack

### **Frontend**
- **React 18**: Modern UI framework
- **React Router**: Navigation and routing
- **React Bootstrap Icons**: Beautiful, consistent icons
- **CSS3**: Custom styling with gradients and animations

### **Backend**
- **Node.js**: Server runtime
- **Express.js**: Web framework
- **MySQL**: Database management
- **JWT**: Authentication and security

## 🚀 Installation

### **Prerequisites**
- Node.js (v16 or higher)
- MySQL (v8.0 or higher)
- Git

### **Setup Instructions**

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/delodur-pos.git
   cd delodur-pos
   ```

2. **Install dependencies**
   ```bash
   # Install server dependencies
   npm install
   
   # Install client dependencies
   cd client
   npm install
   cd ..
   ```

3. **Database Setup**
   ```bash
   # Create MySQL database
   mysql -u root -p
   CREATE DATABASE inventory_system;
   USE inventory_system;
   
   # Import your existing database schema
   source database.sql;
   ```

4. **Environment Configuration**
   ```bash
   # Copy environment template
   cp env.example .env
   
   # Edit .env with your database credentials
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=your_password
   DB_NAME=inventory_system
   JWT_SECRET=your_jwt_secret
   ```

5. **Start the application**
   ```bash
   # Start the server (from root directory)
   npm start
   
   # Start the client (in a new terminal, from client directory)
   cd client
   npm start
   ```

## 📱 Usage

### **Login**
- Default credentials: `admin` / `password`
- Secure JWT authentication

### **Navigation**
- **Dashboard**: Overview and quick actions
- **Stocks**: Inventory management
- **Sales**: Point of sale transactions
- **Products**: Product catalog management
- **Suppliers**: Supplier information
- **Reports**: Analytics and reporting

### **Sales Process**
1. Navigate to **Sales** section
2. Search for products by name or code
3. Click products to add to cart
4. Adjust quantities using +/- buttons
5. Review totals and tax calculation
6. Complete the sale

## 🎨 Design Features

### **Color Scheme**
- **Primary**: Deep blacks (#0a0a0a, #1a1a1a)
- **Accent**: Blue gradients (#007bff, #00d4ff)
- **Metallic**: Silver grays (#2a2a2a, #3a3a3a)
- **Text**: White and light grays (#ffffff, #cccccc)

### **Animations**
- Smooth hover effects
- Gradient transitions
- Loading states
- Shimmer effects

### **Typography**
- Modern, clean fonts
- Proper hierarchy
- Excellent readability
- Touch-optimized sizing

## 🔧 Configuration

### **Customization**
- Modify colors in `client/src/App.css`
- Update company branding in `client/src/components/POSLayout.js`
- Adjust tax rates in `client/src/components/Sales.js`

### **Database**
- Connect to your existing inventory database
- Import legacy data using provided migration scripts
- Maintain data integrity with foreign key relationships

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📞 Support

For support and questions:
- Create an issue on GitHub
- Contact: [your-email@example.com]
- Documentation: [link-to-docs]

## 🎉 Acknowledgments

- **React Bootstrap Icons** for beautiful icons
- **Express.js** for robust backend framework
- **MySQL** for reliable database management
- **Modern CSS** for stunning visual effects

---

**Built with ❤️ for DELODUR CORPORATION** 